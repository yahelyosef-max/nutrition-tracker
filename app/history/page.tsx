import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/supabase/server";
import { daysBefore, hebrewDayName, localDate } from "@/lib/dates";
import { summarize } from "@/lib/history";
import { DEFAULT_PHASE } from "@/lib/data";
import type { LogEntry, Phase } from "@/lib/types";
import Nav from "../nav";
import HistoryCharts from "./charts";

export const dynamic = "force-dynamic";

const RANGES = [7, 14, 30];
const fmt = (n: number) => n.toLocaleString("he-IL");
const shortDate = (d: string) => `${Number(d.slice(8, 10))}.${Number(d.slice(5, 7))}`;

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const { supabase, user } = await currentUser();
  if (!user) redirect("/login");

  const { days: daysParam } = await searchParams;
  const days = RANGES.includes(Number(daysParam)) ? Number(daysParam) : 14;
  const today = localDate();

  const [entries, phases] = await Promise.all([
    supabase
      .from("log_entries")
      .select("id,eaten_on,slot,meal_id,name,portion,kcal,protein,source,status")
      .gte("eaten_on", daysBefore(today, days - 1))
      .lte("eaten_on", today)
      .order("created_at"),
    supabase.from("phases").select("kind,kcal_target,protein_target,started_on"),
  ]);

  const s = summarize({
    today,
    days,
    entries: (entries.data ?? []) as LogEntry[],
    phases: (phases.data ?? []) as Phase[],
    fallback: { kcal: DEFAULT_PHASE.kcal_target, protein: DEFAULT_PHASE.protein_target },
  });
  const anyLogged = s.days.some((d) => d.logged);

  return (
    <>
      <main className="page">
        <h1 className="title">היסטוריה</h1>

        <nav className="row" aria-label="טווח">
          {RANGES.map((r) => (
            <Link
              key={r}
              href={`/history?days=${r}`}
              className={`btn grow${r === days ? " primary" : ""}`}
              aria-current={r === days ? "page" : undefined}
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}
            >
              {r} ימים
            </Link>
          ))}
        </nav>

        {!anyLogged ? (
          <p className="card muted" style={{ margin: 0 }}>עוד אין רישומים בטווח הזה. ברגע שתאשר ארוחות במסך היום, הן יופיעו כאן.</p>
        ) : (
          <>
            <section className="row" aria-label="סיכום">
              <div className="card grow stack" style={{ gap: 2 }}>
                <span className="small muted">ממוצע קלוריות</span>
                <span style={{ fontSize: 22, fontWeight: 800 }}>{s.avgKcal == null ? "—" : fmt(s.avgKcal)}</span>
                <span className="small muted">ביעד ב-{s.kcalOnTarget} מתוך {s.loggedDays} ימים</span>
              </div>
              <div className="card grow stack" style={{ gap: 2 }}>
                <span className="small muted">ממוצע חלבון</span>
                <span className="protein" style={{ fontSize: 22, fontWeight: 800 }}>{s.avgProtein == null ? "—" : `${s.avgProtein} ג׳`}</span>
                <span className="small muted">הגעת ליעד ב-{s.proteinHit} מתוך {s.loggedDays} ימים</span>
              </div>
            </section>
            <p className="small muted" style={{ margin: 0 }}>
              ממוצעים לפי ימים שנרשמו, בלי היום. ״ביעד״ = עד 10% מיעד הקלוריות. לחץ על עמודה לפירוט.
            </p>

            <HistoryCharts days={s.days} today={today} />

            <section className="stack" aria-label="כל הימים">
              <h2 className="h2">יום אחרי יום</h2>
              <div className="card" style={{ padding: 0, overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                  <thead>
                    <tr className="small muted" style={{ textAlign: "right" }}>
                      <th style={{ padding: "10px 14px", fontWeight: 500 }}>יום</th>
                      <th style={{ padding: "10px 8px", fontWeight: 500 }}>קק״ל</th>
                      <th style={{ padding: "10px 14px", fontWeight: 500 }}>חלבון (ג׳)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...s.days].reverse().map((d) => {
                      const kcalOk = Math.abs(d.kcal - d.kcalTarget) <= d.kcalTarget * 0.1;
                      const proteinOk = d.protein >= d.proteinTarget;
                      return (
                        <tr key={d.date} style={{ borderTop: "1px solid var(--line)" }}>
                          <td style={{ padding: "10px 14px" }}>
                            {d.date === today ? "היום" : hebrewDayName(d.date).replace("יום ", "")}{" "}
                            <span className="muted small">{shortDate(d.date)}</span>
                          </td>
                          {d.logged ? (
                            <>
                              <td style={{ padding: "10px 8px" }}>
                                {fmt(d.kcal)}
                                {d.date !== today && <span className="small muted"> {kcalOk ? "✓" : d.kcal > d.kcalTarget ? "↑" : "↓"}</span>}
                              </td>
                              <td style={{ padding: "10px 14px" }}>
                                {d.protein}
                                {d.date !== today && <span className="small muted"> {proteinOk ? "✓" : "↓"}</span>}
                              </td>
                            </>
                          ) : (
                            <td colSpan={2} className="small muted" style={{ padding: "10px 8px" }}>לא נרשם</td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="small muted" style={{ margin: 0 }}>✓ ביעד · ↑ מעל · ↓ מתחת</p>
            </section>
          </>
        )}
      </main>
      <Nav current="/history" />
    </>
  );
}
