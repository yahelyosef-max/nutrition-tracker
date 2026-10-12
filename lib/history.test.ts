import { test } from "node:test";
import assert from "node:assert/strict";
import { phaseOn, summarize } from "./history.ts";
import type { LogEntry, Phase } from "./types.ts";

const e = (eaten_on: string, kcal: number, protein: number, status: LogEntry["status"] = "confirmed"): LogEntry => ({
  id: `${eaten_on}-${kcal}`, eaten_on, slot: "lunch", meal_id: null, name: "x", portion: 1, kcal, protein, source: "manual", status,
});
const phases: Phase[] = [
  { kind: "cut", kcal_target: 1900, protein_target: 150, started_on: "2026-10-01" },
  { kind: "maintain", kcal_target: 2350, protein_target: 125, started_on: "2026-10-08" },
];

test("phase in effect on a date", () => {
  assert.equal(phaseOn("2026-10-05", phases)?.kind, "cut");
  assert.equal(phaseOn("2026-10-08", phases)?.kind, "maintain");
  assert.equal(phaseOn("2026-09-20", phases)?.kind, "cut"); // before any phase → earliest
  assert.equal(phaseOn("2026-10-05", []), null);
});

test("daily totals, targets per phase, averages exclude today and empty days", () => {
  const s = summarize({
    today: "2026-10-09",
    days: 3,
    phases,
    fallback: { kcal: 2000, protein: 100 },
    entries: [
      e("2026-10-07", 1000, 80), e("2026-10-07", 900, 70), // 1900 / 150 — cut day, on target
      e("2026-10-08", 0, 0, "skipped"),                    // only a skip → not logged
      e("2026-10-09", 500, 30),                            // today
      e("2026-10-01", 3000, 10),                           // outside the window
    ],
  });
  assert.deepEqual(s.days.map((d) => d.date), ["2026-10-07", "2026-10-08", "2026-10-09"]);
  assert.deepEqual(s.days.map((d) => d.kcal), [1900, 0, 500]);
  assert.deepEqual(s.days.map((d) => d.kcalTarget), [1900, 2350, 2350]);
  assert.deepEqual(s.days.map((d) => d.logged), [true, false, true]);
  assert.equal(s.loggedDays, 1);
  assert.equal(s.avgKcal, 1900);
  assert.equal(s.avgProtein, 150);
  assert.equal(s.kcalOnTarget, 1);
  assert.equal(s.proteinHit, 1);
});

test("no data → null averages", () => {
  const s = summarize({ today: "2026-10-09", days: 7, phases: [], fallback: { kcal: 2000, protein: 100 }, entries: [] });
  assert.equal(s.avgKcal, null);
  assert.equal(s.days.length, 7);
  assert.equal(s.days[0].kcalTarget, 2000);
});
