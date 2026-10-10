import { SLOTS, type LogEntry, type Meal, type Slot } from "./types.ts";
import { daysBefore, weekday } from "./dates.ts";

/** How far back the day is predicted from. */
export const WINDOW_DAYS = 28;
/** A meal is shown as "expected" only if eaten in at least this share of logged days. */
export const MIN_SHARE = 0.4;
/** Below this many logged days, predictions come from each meal's default slot. */
export const COLD_START_DAYS = 7;

export type Prediction = {
  meal: Meal;
  /** Weighted share of logged days the meal was eaten in this slot (0–1). */
  share: number;
  timesEaten: number;
  daysLogged: number;
};

export type SlotPlan = {
  slot: Slot;
  label: string;
  time: string;
  entries: LogEntry[];
  skipped: boolean;
  prediction: Prediction | null;
  alternatives: Meal[];
};

export type DayPlan = {
  slots: SlotPlan[];
  eaten: { kcal: number; protein: number };
  expected: { kcal: number; protein: number };
};

type PlanInput = {
  today: string;
  meals: Meal[];
  /** All entries in the window, today's included. */
  entries: LogEntry[];
};

export function planDay({ today, meals, entries }: PlanInput): DayPlan {
  const active = meals.filter((m) => !m.archived);
  const byId = new Map(active.map((m) => [m.id, m]));
  const from = daysBefore(today, WINDOW_DAYS);
  const todayDow = weekday(today);
  const dayWeight = (d: string) => (weekday(d) === todayDow ? 2 : 1);

  const past = entries.filter((e) => e.eaten_on >= from && e.eaten_on < today);
  const todays = entries.filter((e) => e.eaten_on === today);

  const loggedDays = [...new Set(past.map((e) => e.eaten_on))];
  const weightedDays = loggedDays.reduce((sum, d) => sum + dayWeight(d), 0);
  const cold = loggedDays.length < COLD_START_DAYS;

  const slots: SlotPlan[] = SLOTS.map(({ id: slot, label, time }) => {
    const slotToday = todays.filter((e) => e.slot === slot);
    const entriesToday = slotToday.filter((e) => e.status === "confirmed");
    const skipped = slotToday.some((e) => e.status === "skipped");

    // Weighted count of days each meal was eaten in this slot.
    const daysPerMeal = new Map<string, Set<string>>();
    for (const e of past) {
      if (e.slot !== slot || e.status !== "confirmed" || !e.meal_id || !byId.has(e.meal_id)) continue;
      if (!daysPerMeal.has(e.meal_id)) daysPerMeal.set(e.meal_id, new Set());
      daysPerMeal.get(e.meal_id)!.add(e.eaten_on);
    }
    const ranked = [...daysPerMeal.entries()]
      .map(([id, days]) => ({
        meal: byId.get(id)!,
        weighted: [...days].reduce((s, d) => s + dayWeight(d), 0),
        times: days.size,
      }))
      .sort((a, b) => b.weighted - a.weighted || b.times - a.times);

    const defaults = active.filter((m) => m.default_slot === slot);
    let prediction: Prediction | null = null;

    if (!cold && ranked.length > 0 && weightedDays > 0) {
      const top = ranked[0];
      const share = top.weighted / weightedDays;
      if (share >= MIN_SHARE) {
        prediction = { meal: top.meal, share, timesEaten: top.times, daysLogged: loggedDays.length };
      }
    } else if (cold && defaults.length === 1) {
      prediction = { meal: defaults[0], share: 1, timesEaten: 0, daysLogged: loggedDays.length };
    }

    const seen = new Set(prediction ? [prediction.meal.id] : []);
    const alternatives: Meal[] = [];
    for (const m of [...ranked.map((r) => r.meal), ...defaults]) {
      if (alternatives.length >= 3) break;
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      alternatives.push(m);
    }

    return { slot, label, time, entries: entriesToday, skipped, prediction, alternatives };
  });

  const eaten = sum(todays.filter((e) => e.status === "confirmed"));
  const pending = slots
    .filter((s) => s.entries.length === 0 && !s.skipped && s.prediction)
    .map((s) => s.prediction!.meal);
  const expected = {
    kcal: eaten.kcal + pending.reduce((n, m) => n + m.kcal, 0),
    protein: eaten.protein + pending.reduce((n, m) => n + m.protein, 0),
  };

  return { slots, eaten, expected };
}

function sum(entries: LogEntry[]) {
  return entries.reduce(
    (acc, e) => ({ kcal: acc.kcal + e.kcal, protein: acc.protein + e.protein }),
    { kcal: 0, protein: 0 },
  );
}

export type GapSuggestion = { meals: Meal[]; kcal: number; protein: number; fits: boolean };

const GAP_SLOTS: Slot[] = ["afternoon", "evening", "night"];

/**
 * Up to 3 combinations of 1–2 library meals that close the remaining gap:
 * calories within ±10%, protein at least the remaining protein.
 * Prefers meals eaten often and meals with a vegetable.
 */
export function suggestForGap(
  gap: { kcal: number; protein: number },
  meals: Meal[],
  entries: LogEntry[] = [],
): GapSuggestion[] {
  if (gap.kcal < 100) return [];
  const pool = meals.filter((m) => !m.archived && m.default_slot && GAP_SLOTS.includes(m.default_slot));
  const freq = new Map<string, number>();
  for (const e of entries) if (e.meal_id && e.status === "confirmed") freq.set(e.meal_id, (freq.get(e.meal_id) ?? 0) + 1);
  const maxFreq = Math.max(1, ...freq.values());

  const combos: Meal[][] = [];
  pool.forEach((a, i) => {
    combos.push([a]);
    pool.slice(i + 1).forEach((b) => combos.push([a, b]));
  });

  const proteinNeed = Math.max(0, gap.protein);
  return combos
    .map((ms) => {
      const kcal = ms.reduce((n, m) => n + m.kcal, 0);
      const protein = ms.reduce((n, m) => n + m.protein, 0);
      const kcalOff = Math.abs(kcal - gap.kcal) / gap.kcal;
      const proteinShort = Math.max(0, proteinNeed - protein) / Math.max(proteinNeed, 1);
      const fits = kcalOff <= 0.1 && proteinShort === 0;
      const habit = ms.reduce((n, m) => n + (freq.get(m.id) ?? 0), 0) / (maxFreq * ms.length);
      const veg = ms.some((m) => m.has_vegetable) ? 1 : 0;
      const score = kcalOff + proteinShort - 0.08 * veg - 0.05 * habit + (ms.length - 1) * 0.02;
      return { meals: ms, kcal, protein, fits, score };
    })
    .sort((a, b) => Number(b.fits) - Number(a.fits) || a.score - b.score)
    .slice(0, 3)
    .map(({ score: _score, ...s }) => s);
}
