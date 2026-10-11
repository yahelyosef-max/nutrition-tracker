import { SLOTS, type Slot } from "./types.ts";

export type RecognizedItem = { name: string; grams: number | null; kcal: number; protein: number };

export type Recognition = {
  dish: string;
  items: RecognizedItem[];
  kcal: number;
  protein: number;
  matchedMealId: string | null;
  confidence: number; // 0–1
  note: string | null;
};

const clampInt = (v: unknown, min: number, max: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
};
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Turn whatever the model returned into a safe, consistent Recognition. */
export function normalizeRecognition(raw: unknown, libraryIds: string[]): Recognition {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const items: RecognizedItem[] = (Array.isArray(r.items) ? r.items : [])
    .slice(0, 12)
    .map((it) => {
      const o = (it && typeof it === "object" ? it : {}) as Record<string, unknown>;
      const grams = o.grams == null ? null : clampInt(o.grams, 0, 3000);
      return { name: text(o.name, 60), grams, kcal: clampInt(o.kcal, 0, 3000), protein: clampInt(o.protein, 0, 300) };
    })
    .filter((it) => it.name);

  const sumKcal = items.reduce((n, i) => n + i.kcal, 0);
  const sumProtein = items.reduce((n, i) => n + i.protein, 0);
  const matched = typeof r.matched_meal_id === "string" && libraryIds.includes(r.matched_meal_id) ? r.matched_meal_id : null;
  const confidence = Math.min(1, Math.max(0, Number(r.confidence) || 0));

  return {
    dish: text(r.dish, 80) || items.map((i) => i.name).join(" + ").slice(0, 80) || "ארוחה מצולמת",
    items,
    // Item sums are the source of truth when present; fall back to the reported totals.
    kcal: items.length ? sumKcal : clampInt(r.total_kcal, 0, 5000),
    protein: items.length ? sumProtein : clampInt(r.total_protein, 0, 400),
    matchedMealId: matched,
    confidence,
    note: text(r.note, 200) || null,
  };
}

/** The meal slot a photo taken at HH:MM most likely belongs to. */
export function slotForTime(hhmm: string): Slot {
  let current: Slot = "breakfast";
  for (const s of SLOTS) {
    // Switch to a slot from 45 minutes before its usual time.
    const [h, m] = s.time.split(":").map(Number);
    const start = Math.max(0, h * 60 + m - 45);
    const [nh, nm] = hhmm.split(":").map(Number);
    if (nh * 60 + nm >= start) current = s.id;
  }
  return current;
}
