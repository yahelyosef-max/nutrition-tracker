import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeRecognition, slotForTime } from "./recognition.ts";

test("totals come from the items; values are clamped and cleaned", () => {
  const r = normalizeRecognition(
    {
      dish: "  פרגיות עם אורז  ",
      items: [
        { name: "פרגיות", grams: 180, kcal: 380, protein: 42.6 },
        { name: "אורז לבן", grams: 150, kcal: 195, protein: 4 },
        { name: "", kcal: 50, protein: 1 },
        { name: "שמן", kcal: -20, protein: "x" },
      ],
      total_kcal: 9999,
      matched_meal_id: "m1",
      confidence: 1.7,
    },
    ["m1", "m2"],
  );
  assert.equal(r.dish, "פרגיות עם אורז");
  assert.equal(r.items.length, 3);
  assert.equal(r.kcal, 380 + 195 + 0);
  assert.equal(r.protein, 43 + 4 + 0);
  assert.equal(r.matchedMealId, "m1");
  assert.equal(r.confidence, 1);
});

test("an unknown matched id is dropped; garbage input gives a safe default", () => {
  assert.equal(normalizeRecognition({ matched_meal_id: "nope", items: [] }, ["m1"]).matchedMealId, null);
  const r = normalizeRecognition(null, []);
  assert.equal(r.dish, "ארוחה מצולמת");
  assert.equal(r.kcal, 0);
});

test("slot by time of day", () => {
  assert.equal(slotForTime("06:30"), "breakfast");
  assert.equal(slotForTime("08:10"), "breakfast");
  assert.equal(slotForTime("10:00"), "mid");
  assert.equal(slotForTime("12:30"), "lunch");
  assert.equal(slotForTime("14:30"), "lunch");
  assert.equal(slotForTime("15:20"), "afternoon");
  assert.equal(slotForTime("19:30"), "evening");
  assert.equal(slotForTime("23:30"), "night");
});
