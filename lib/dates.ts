export const TIME_ZONE = "Asia/Jerusalem";

/** YYYY-MM-DD for the given instant, in Israel time. */
export function localDate(at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

/** Day of week (0 = Sunday) of a YYYY-MM-DD date. */
export function weekday(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

/** YYYY-MM-DD that is `days` before `date`. */
export function daysBefore(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export function hebrewDayName(date: string): string {
  return new Intl.DateTimeFormat("he-IL", { weekday: "long", timeZone: "UTC" }).format(
    new Date(`${date}T12:00:00Z`),
  );
}
