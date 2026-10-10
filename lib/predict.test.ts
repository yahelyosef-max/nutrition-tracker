import { test } from "node:test";
import assert from "node:assert/strict";
import { planDay, suggestForGap } from "./predict.ts";
import { daysBefore } from "./dates.ts";
import type { LogEntry, Meal, Slot } from "./types.ts";

const meal = (id: string, slot: Slot | null, kcal: number, protein: number, extra: Partial<Meal> = {}): Meal => ({
  id, name: id, description: null, kcal, protein, default_slot: slot, has_vegetable: false, archived: false, ...extra,
});

const MEALS = [
  meal("breakfast", "breakfast", 370, 21),
  meal("chicken", "lunch", 700, 48, { has_vegetable: true }),
  meal("salmon", "lunch", 620, 40),
  meal("corto", "mid", 40, 2),
  meal("tofu", "evening", 485, 42),
  meal("tuna", "evening", 260, 26),
  meal("bagel", "evening", 480, 30, { has_vegetable: true }),
  meal("sweet", "night", 320, 8),
];

const TODAY = "2026-10-12"; // Monday
let n = 0;
const entry = (eaten_on: string, slot: Slot, meal_id: string, status: LogEntry["status"] = "confirmed"): LogEntry => {
  const m = MEALS.find((x) => x.id === meal_id)!;
  return { id: `e${n++}`, eaten_on, slot, meal_id, name: m.name, portion: 1, kcal: m.kcal, protein: m.protein, source: "library", status };
};
const slotOf = (plan: ReturnType<typeof planDay>, s: Slot) => plan.slots.find((x) => x.slot === s)!;

test("cold start predicts a slot only when it has a single default meal", () => {
  const plan = planDay({ today: TODAY, meals: MEALS, entries: [] });
  assert.equal(slotOf(plan, "breakfast").prediction?.meal.id, "breakfast");
  assert.equal(slotOf(plan, "lunch").prediction, null);
  assert.equal(slotOf(plan, "evening").prediction, null);
  assert.deepEqual(slotOf(plan, "lunch").alternatives.map((m) => m.id), ["chicken", "salmon"]);
});

test("history wins once there are enough logged days", () => {
  const entries: LogEntry[] = [];
  for (let i = 1; i <= 14; i++) {
    const d = daysBefore(TODAY, i);
    entries.push(entry(d, "breakfast", "breakfast"));
    entries.push(entry(d, "lunch", i % 3 === 0 ? "chicken" : "salmon"));
  }
  const plan = planDay({ today: TODAY, meals: MEALS, entries });
  const lunch = slotOf(plan, "lunch");
  assert.equal(lunch.prediction?.meal.id, "salmon");
  assert.equal(lunch.prediction?.daysLogged, 14);
  assert.deepEqual(lunch.alternatives.map((m) => m.id), ["chicken"]);
});

test("below 40% share there is no prediction, only alternatives", () => {
  const entries: LogEntry[] = [];
  for (let i = 1; i <= 10; i++) {
    const d = daysBefore(TODAY, i);
    entries.push(entry(d, "breakfast", "breakfast"));
    if (i <= 2) entries.push(entry(d, "evening", "tofu"));
  }
  const plan = planDay({ today: TODAY, meals: MEALS, entries });
  assert.equal(slotOf(plan, "evening").prediction, null);
  assert.equal(slotOf(plan, "evening").alternatives[0].id, "tofu");
});

test("same weekday counts double", () => {
  const entries: LogEntry[] = [];
  for (let i = 1; i <= 14; i++) {
    const d = daysBefore(TODAY, i);
    entries.push(entry(d, "breakfast", "breakfast"));
    // Mondays (7, 14 days ago) → chicken; three other days → salmon
    if (i === 7 || i === 14) entries.push(entry(d, "lunch", "chicken"));
    if (i === 1 || i === 2 || i === 3) entries.push(entry(d, "lunch", "salmon"));
  }
  const plan = planDay({ today: TODAY, meals: MEALS, entries });
  // chicken: 2 days × 2 = 4, salmon: 3 days × 1 = 3
  assert.equal(slotOf(plan, "lunch").alternatives.length + (slotOf(plan, "lunch").prediction ? 1 : 0) >= 1, true);
  const ranked = slotOf(plan, "lunch").prediction?.meal.id ?? slotOf(plan, "lunch").alternatives[0].id;
  assert.equal(ranked, "chicken");
});

test("totals: eaten counts confirmed today; expected adds pending predictions, not skipped slots", () => {
  const entries = [entry(TODAY, "breakfast", "breakfast"), entry(TODAY, "mid", "corto", "skipped")];
  const meals = [...MEALS];
  const plan = planDay({ today: TODAY, meals, entries });
  assert.deepEqual(plan.eaten, { kcal: 370, protein: 21 });
  // mid has a single default (corto) but is skipped → not expected; night has one default (sweet)
  assert.deepEqual(plan.expected, { kcal: 370 + 320, protein: 21 + 8 });
  assert.equal(slotOf(plan, "mid").skipped, true);
});

test("gap suggestion closes calories and protein, prefers a fit", () => {
  const out = suggestForGap({ kcal: 750, protein: 55 }, MEALS);
  assert.ok(out.length > 0);
  assert.equal(out[0].fits, true);
  assert.ok(Math.abs(out[0].kcal - 750) <= 75);
  assert.ok(out[0].protein >= 55);
});

test("no suggestion when the gap is tiny", () => {
  assert.deepEqual(suggestForGap({ kcal: 50, protein: 5 }, MEALS), []);
});
