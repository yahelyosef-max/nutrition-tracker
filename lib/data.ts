import { daysBefore, localDate } from "./dates.ts";
import { WINDOW_DAYS } from "./predict.ts";
import type { LogEntry, Meal, Phase, Variant } from "./types.ts";
import type { SupabaseClient } from "@supabase/supabase-js";

export const DEFAULT_PHASE: Phase = { kind: "maintain", kcal_target: 2350, protein_target: 125, started_on: "" };

export async function loadDay(supabase: SupabaseClient, today = localDate()) {
  const [meals, variants, entries, phase] = await Promise.all([
    supabase.from("meals").select("id,name,description,kcal,protein,default_slot,has_vegetable,archived").order("created_at"),
    supabase.from("meal_variants").select("id,meal_id,name,kcal_delta,protein_delta"),
    supabase
      .from("log_entries")
      .select("id,eaten_on,slot,meal_id,name,portion,kcal,protein,source,status")
      .gte("eaten_on", daysBefore(today, WINDOW_DAYS))
      .lte("eaten_on", today)
      .order("created_at"),
    supabase
      .from("phases")
      .select("kind,kcal_target,protein_target,started_on")
      .lte("started_on", today)
      .order("started_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const error = meals.error ?? variants.error ?? entries.error ?? phase.error;
  if (error) throw new Error(error.message);

  return {
    today,
    meals: (meals.data ?? []) as Meal[],
    variants: (variants.data ?? []) as Variant[],
    entries: (entries.data ?? []) as LogEntry[],
    phase: (phase.data as Phase | null) ?? DEFAULT_PHASE,
  };
}
