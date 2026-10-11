"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/supabase/server";
import { localDate } from "@/lib/dates";
import { SLOTS, type Slot } from "@/lib/types";

const SLOT_IDS = new Set(SLOTS.map((s) => s.id));

function asSlot(value: unknown): Slot {
  if (typeof value !== "string" || !SLOT_IDS.has(value as Slot)) throw new Error("משבצת לא תקינה");
  return value as Slot;
}

function asInt(value: unknown, min: number, max: number): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < min || n > max) throw new Error("ערך לא תקין");
  return n;
}

async function requireUser() {
  const { supabase, user } = await currentUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

function done(error: { message: string } | null) {
  if (error) throw new Error(error.message);
  revalidatePath("/");
}

/** Log a library meal (optionally a variant, optionally a half portion). */
export async function logMeal(input: { slot: Slot; mealId: string; variantId?: string; portion?: number }) {
  const { supabase, user } = await requireUser();
  const slot = asSlot(input.slot);
  const portion = input.portion === 0.5 ? 0.5 : 1;

  const { data: meal, error } = await supabase
    .from("meals")
    .select("id,name,kcal,protein")
    .eq("id", input.mealId)
    .single();
  if (error || !meal) throw new Error("הארוחה לא נמצאה");

  let kcal = meal.kcal;
  let protein = meal.protein;
  let name = meal.name;
  let variantId: string | null = null;
  if (input.variantId) {
    const { data: v } = await supabase
      .from("meal_variants")
      .select("id,name,kcal_delta,protein_delta")
      .eq("id", input.variantId)
      .eq("meal_id", meal.id)
      .single();
    if (v) {
      kcal += v.kcal_delta;
      protein += v.protein_delta;
      name = `${name} · ${v.name}`;
      variantId = v.id;
    }
  }
  if (portion !== 1) name = `${name} · חצי מנה`;

  const res = await supabase.from("log_entries").insert({
    user_id: user.id,
    eaten_on: localDate(),
    slot,
    meal_id: meal.id,
    variant_id: variantId,
    name,
    portion,
    kcal: Math.round(kcal * portion),
    protein: Math.round(protein * portion),
    source: "library",
    status: "confirmed",
  });
  done(res.error);
}

/** Log something that isn't in the library. */
export async function logManual(input: { slot: Slot; name: string; kcal: number; protein: number }) {
  const { supabase, user } = await requireUser();
  const name = String(input.name ?? "").trim().slice(0, 80);
  if (!name) throw new Error("חסר שם");
  const res = await supabase.from("log_entries").insert({
    user_id: user.id,
    eaten_on: localDate(),
    slot: asSlot(input.slot),
    name,
    kcal: asInt(input.kcal, 0, 5000),
    protein: asInt(input.protein, 0, 400),
    source: "manual",
    status: "confirmed",
  });
  done(res.error);
}

/** Log a meal recognized from a photo; optionally also add it to the library. */
export async function logPhoto(input: {
  slot: Slot;
  name: string;
  kcal: number;
  protein: number;
  mealId?: string | null;
  saveToLibrary?: boolean;
}) {
  const { supabase, user } = await requireUser();
  const slot = asSlot(input.slot);
  const name = String(input.name ?? "").trim().slice(0, 80) || "ארוחה מצולמת";
  const kcal = asInt(input.kcal, 0, 5000);
  const protein = asInt(input.protein, 0, 400);

  let mealId: string | null = null;
  if (input.mealId) {
    const { data } = await supabase.from("meals").select("id").eq("id", input.mealId).maybeSingle();
    mealId = data?.id ?? null;
  }
  if (!mealId && input.saveToLibrary) {
    const { data, error } = await supabase
      .from("meals")
      .insert({ user_id: user.id, name, kcal, protein, default_slot: slot })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    mealId = data.id;
  }

  const res = await supabase.from("log_entries").insert({
    user_id: user.id,
    eaten_on: localDate(),
    slot,
    meal_id: mealId,
    name,
    kcal,
    protein,
    source: "photo",
    status: "confirmed",
  });
  done(res.error);
  if (input.saveToLibrary) revalidatePath("/meals");
}

export async function skipSlot(slot: Slot) {
  const { supabase, user } = await requireUser();
  const res = await supabase.from("log_entries").insert({
    user_id: user.id,
    eaten_on: localDate(),
    slot: asSlot(slot),
    name: "דילוג",
    kcal: 0,
    protein: 0,
    source: "manual",
    status: "skipped",
  });
  done(res.error);
}

export async function removeEntry(id: string) {
  const { supabase } = await requireUser();
  const res = await supabase.from("log_entries").delete().eq("id", id);
  done(res.error);
}

/** Undo a skip: removes today's skip markers for the slot. */
export async function unskipSlot(slot: Slot) {
  const { supabase } = await requireUser();
  const res = await supabase
    .from("log_entries")
    .delete()
    .eq("eaten_on", localDate())
    .eq("slot", asSlot(slot))
    .eq("status", "skipped");
  done(res.error);
}

export async function saveMeal(form: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(form.get("id") ?? "");
  const row = {
    user_id: user.id,
    name: String(form.get("name") ?? "").trim().slice(0, 80),
    description: String(form.get("description") ?? "").trim().slice(0, 200) || null,
    kcal: asInt(form.get("kcal"), 0, 5000),
    protein: asInt(form.get("protein"), 0, 400),
    default_slot: form.get("default_slot") ? asSlot(form.get("default_slot")) : null,
    has_vegetable: form.get("has_vegetable") === "on",
  };
  if (!row.name) throw new Error("חסר שם");
  const res = id
    ? await supabase.from("meals").update(row).eq("id", id)
    : await supabase.from("meals").insert(row);
  if (res.error) throw new Error(res.error.message);
  revalidatePath("/meals");
  revalidatePath("/");
  redirect("/meals");
}

export async function archiveMeal(id: string) {
  const { supabase } = await requireUser();
  const res = await supabase.from("meals").update({ archived: true }).eq("id", id);
  if (res.error) throw new Error(res.error.message);
  revalidatePath("/meals");
  revalidatePath("/");
}

export async function saveTargets(form: FormData) {
  const { supabase, user } = await requireUser();
  const kind = String(form.get("kind"));
  if (!["cut", "maintain", "bulk"].includes(kind)) throw new Error("שלב לא תקין");
  const res = await supabase.from("phases").insert({
    user_id: user.id,
    kind,
    kcal_target: asInt(form.get("kcal_target"), 800, 6000),
    protein_target: asInt(form.get("protein_target"), 20, 400),
    started_on: localDate(),
  });
  if (res.error) throw new Error(res.error.message);
  revalidatePath("/");
  revalidatePath("/settings");
  redirect("/");
}

export async function signOut() {
  const { supabase } = await requireUser();
  await supabase.auth.signOut();
  redirect("/login");
}
