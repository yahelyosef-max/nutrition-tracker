import { daysBefore } from "./dates.ts";
import type { LogEntry, Phase } from "./types.ts";

export type DaySummary = {
  date: string;
  logged: boolean;
  kcal: number;
  protein: number;
  kcalTarget: number;
  proteinTarget: number;
  entries: LogEntry[];
};

export type HistorySummary = {
  days: DaySummary[]; // oldest → newest
  loggedDays: number;
  avgKcal: number | null;
  avgProtein: number | null;
  /** Logged days within ±10% of the calorie target. */
  kcalOnTarget: number;
  /** Logged days that reached the protein target. */
  proteinHit: number;
};

/** The phase in effect on a date: the latest one that started on or before it (else the earliest). */
export function phaseOn(date: string, phases: Phase[]): Phase | null {
  const sorted = [...phases].sort((a, b) => a.started_on.localeCompare(b.started_on));
  let current: Phase | null = sorted[0] ?? null;
  for (const p of sorted) if (p.started_on <= date) current = p;
  return current;
}

export function summarize(input: {
  today: string;
  days: number;
  entries: LogEntry[];
  phases: Phase[];
  fallback: { kcal: number; protein: number };
}): HistorySummary {
  const { today, days, entries, phases, fallback } = input;
  const out: DaySummary[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = daysBefore(today, i);
    const dayEntries = entries.filter((e) => e.eaten_on === date && e.status === "confirmed");
    const phase = phaseOn(date, phases);
    out.push({
      date,
      logged: dayEntries.length > 0,
      kcal: dayEntries.reduce((n, e) => n + e.kcal, 0),
      protein: dayEntries.reduce((n, e) => n + e.protein, 0),
      kcalTarget: phase?.kcal_target ?? fallback.kcal,
      proteinTarget: phase?.protein_target ?? fallback.protein,
      entries: dayEntries,
    });
  }

  // Today is still in progress: it is shown but left out of the averages.
  const complete = out.filter((d) => d.logged && d.date !== today);
  const n = complete.length;
  return {
    days: out,
    loggedDays: n,
    avgKcal: n ? Math.round(complete.reduce((s, d) => s + d.kcal, 0) / n) : null,
    avgProtein: n ? Math.round(complete.reduce((s, d) => s + d.protein, 0) / n) : null,
    kcalOnTarget: complete.filter((d) => Math.abs(d.kcal - d.kcalTarget) <= d.kcalTarget * 0.1).length,
    proteinHit: complete.filter((d) => d.protein >= d.proteinTarget).length,
  };
}
