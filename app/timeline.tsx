"use client";

import { useMemo, useState, useTransition } from "react";
import type { DayPlan, GapSuggestion, SlotPlan } from "@/lib/predict";
import type { Meal, Slot, Variant } from "@/lib/types";
import { logManual, logMeal, removeEntry, skipSlot, unskipSlot } from "./actions";

type Props = {
  dayName: string;
  plan: DayPlan;
  meals: Meal[];
  variants: Variant[];
  targets: { kcal: number; protein: number };
  suggestions: GapSuggestion[];
};

const fmt = (n: number) => n.toLocaleString("he-IL");

function nowHHMM() {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

export default function Timeline({ dayName, plan, meals, variants, targets, suggestions }: Props) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<void>) =>
    start(async () => {
      setError(null);
      try {
        await fn();
      } catch {
        setError("משהו השתבש. נסה שוב.");
      }
    });

  const unresolved = (s: SlotPlan) => s.entries.length === 0 && !s.skipped;
  const activeSlot = useMemo(() => {
    const now = nowHHMM();
    const due = plan.slots.filter((s) => unresolved(s) && s.time <= now);
    return (due[0] ?? plan.slots.find(unresolved))?.slot ?? null;
  }, [plan]);
  const [open, setOpen] = useState<Slot | null>(activeSlot);

  const left = { kcal: targets.kcal - plan.eaten.kcal, protein: targets.protein - plan.eaten.protein };
  const after = { kcal: targets.kcal - plan.expected.kcal, protein: targets.protein - plan.expected.protein };

  return (
    <main className="page" aria-busy={pending}>
      <div className="row between" style={{ alignItems: "baseline" }}>
        <h1 className="title">יום {dayName.replace("יום ", "")}</h1>
        <span className="small muted">
          נשאר <b style={{ color: "var(--ink)" }}>{fmt(Math.max(0, left.kcal))}</b> קק״ל ·{" "}
          <b className="protein">{Math.max(0, left.protein)} ג׳</b>
        </span>
      </div>
      <Bars eaten={plan.eaten} targets={targets} />
      <p className="small muted" style={{ margin: 0 }}>
        הכנו לך את היום לפי מה שאתה אוכל בדרך כלל. אשר, החלף או דלג.
      </p>
      {error && <p role="alert" className="small protein" style={{ margin: 0 }}>{error}</p>}

      <div className="stack">
        {plan.slots.map((s) => (
          <SlotCard
            key={s.slot}
            plan={s}
            meals={meals}
            variants={variants}
            open={open === s.slot}
            active={activeSlot === s.slot}
            onToggle={() => setOpen(open === s.slot ? null : s.slot)}
            suggestions={s.slot === "evening" ? suggestions : []}
            run={run}
            pending={pending}
          />
        ))}
      </div>

      <section className="card dark stack" style={{ gap: 6 }} aria-label="תחזית לסוף היום">
        <span className="small muted">תחזית לסוף היום</span>
        <span style={{ fontSize: 15, lineHeight: 1.4 }}>{forecastText(after)}</span>
      </section>
    </main>
  );
}

function forecastText(after: { kcal: number; protein: number }) {
  const protein =
    after.protein <= 0 ? "יעד החלבון יושג" : `יחסרו עוד ${after.protein} ג׳ חלבון`;
  if (after.kcal > 100) return `אם תאשר את הצפוי, ${protein} ויישארו לערב ~${fmt(after.kcal)} קק״ל.`;
  if (after.kcal < -100) return `אם תאשר את הצפוי, תעבור את היעד בכ-${fmt(-after.kcal)} קק״ל. ${protein}.`;
  return `אם תאשר את הצפוי, תסיים בדיוק ביעד. ${protein}.`;
}

function Bars({ eaten, targets }: { eaten: { kcal: number; protein: number }; targets: { kcal: number; protein: number } }) {
  const pct = (a: number, b: number) => `${Math.min(100, Math.round((a / Math.max(b, 1)) * 100))}%`;
  return (
    <div className="card stack" style={{ gap: 10 }}>
      <div className="stack" style={{ gap: 4 }}>
        <div className="row between small"><b>קלוריות</b><span className="muted">{fmt(eaten.kcal)} / {fmt(targets.kcal)}</span></div>
        <div className="bar" role="progressbar" aria-label="קלוריות" aria-valuenow={eaten.kcal} aria-valuemax={targets.kcal}>
          <span style={{ width: pct(eaten.kcal, targets.kcal) }} />
        </div>
      </div>
      <div className="stack" style={{ gap: 4 }}>
        <div className="row between small"><b>חלבון</b><span className="muted">{eaten.protein} / {targets.protein} ג׳</span></div>
        <div className="bar protein-bar" role="progressbar" aria-label="חלבון" aria-valuenow={eaten.protein} aria-valuemax={targets.protein}>
          <span style={{ width: pct(eaten.protein, targets.protein) }} />
        </div>
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
      <path d="M5 12l5 5 9-10" />
    </svg>
  );
}

type CardProps = {
  plan: SlotPlan;
  meals: Meal[];
  variants: Variant[];
  open: boolean;
  active: boolean;
  onToggle: () => void;
  suggestions: GapSuggestion[];
  run: (fn: () => Promise<void>) => void;
  pending: boolean;
};

function SlotCard({ plan, meals, variants, open, active, onToggle, suggestions, run, pending }: CardProps) {
  const { slot, label, time, entries, skipped, prediction, alternatives } = plan;
  const resolved = entries.length > 0 || skipped;

  let title: string;
  let sub: string;
  if (entries.length > 0) {
    const kcal = entries.reduce((n, e) => n + e.kcal, 0);
    const protein = entries.reduce((n, e) => n + e.protein, 0);
    title = entries.map((e) => e.name).join(" + ");
    sub = `${fmt(kcal)} קק״ל · ${protein} ג׳`;
  } else if (skipped) {
    title = `${label} — דילגת`;
    sub = "לא נספר ביום";
  } else if (prediction) {
    title = `${label} — ${prediction.meal.name}${active ? "?" : ""}`;
    sub =
      `${fmt(prediction.meal.kcal)} קק״ל · ${prediction.meal.protein} ג׳` +
      (prediction.timesEaten > 0 ? ` · נאכל ${prediction.timesEaten} מתוך ${prediction.daysLogged} ימים` : " · צפוי");
  } else {
    title = slot === "evening" && suggestions.length ? `${label} — ייקבע לפי הפער` : `${label} — מה אכלת?`;
    sub = alternatives.length ? `${alternatives.length} הצעות` : "אין עדיין הצעות";
  }

  const cls = `card${active && open ? " active" : resolved ? "" : " pending"}`;
  const predVariants = prediction ? variants.filter((v) => v.meal_id === prediction.meal.id) : [];
  const others = meals.filter((m) => m.id !== prediction?.meal.id && !alternatives.some((a) => a.id === m.id));

  return (
    <section className={cls} aria-label={label}>
      <div className="row">
        <span className="time" style={active ? { color: "var(--green)", fontWeight: 700 } : undefined}>{time}</span>
        <button
          className="grow"
          onClick={onToggle}
          aria-expanded={open}
          style={{ background: "none", border: 0, padding: 0, textAlign: "right", cursor: "pointer", minHeight: 44 }}
        >
          <span className="meal-name" style={{ display: "block", color: resolved || active ? undefined : "var(--muted)", fontWeight: resolved || active ? 700 : 500 }}>
            {title}
          </span>
          <span className="small muted">{sub}</span>
        </button>
        {entries.length > 0 && (
          <span className="check" role="img" aria-label="אושר"><CheckIcon /></span>
        )}
        {!resolved && prediction && !open && (
          <button
            className="check"
            style={{ background: "transparent", color: "var(--green)", border: "2px solid var(--green)" }}
            aria-label={`אכלתי ${prediction.meal.name}`}
            disabled={pending}
            onClick={() => run(() => logMeal({ slot, mealId: prediction.meal.id }))}
          >
            <CheckIcon />
          </button>
        )}
      </div>

      {open && (
        <div className="sheet">
          {entries.map((e) => (
            <div key={e.id} className="row small">
              <span className="grow">{e.name} · {fmt(e.kcal)} קק״ל · {e.protein} ג׳</span>
              <button className="btn ghost" disabled={pending} onClick={() => run(() => removeEntry(e.id))}>הסר</button>
            </div>
          ))}

          {skipped && (
            <button className="btn" disabled={pending} onClick={() => run(() => unskipSlot(slot))}>בטל דילוג</button>
          )}

          {!skipped && prediction && entries.length === 0 && (
            <div className="row">
              <button className="btn primary grow" disabled={pending} onClick={() => run(() => logMeal({ slot, mealId: prediction.meal.id }))}>
                אכלתי
              </button>
              <button className="btn" disabled={pending} onClick={() => run(() => logMeal({ slot, mealId: prediction.meal.id, portion: 0.5 }))}>
                חצי מנה
              </button>
            </div>
          )}
          {!skipped && entries.length === 0 && predVariants.length > 0 && (
            <div className="chips">
              {predVariants.map((v) => (
                <button key={v.id} className="chip" disabled={pending} onClick={() => run(() => logMeal({ slot, mealId: v.meal_id, variantId: v.id }))}>
                  {v.name}
                </button>
              ))}
            </div>
          )}

          {!skipped && suggestions.length > 0 && entries.length === 0 && (
            <div className="stack">
              <span className="small muted">לסגירת הפער:</span>
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  className="chip"
                  style={{ textAlign: "right", minHeight: 48, borderRadius: 12 }}
                  disabled={pending}
                  onClick={() => run(async () => { for (const m of s.meals) await logMeal({ slot, mealId: m.id }); })}
                >
                  {s.meals.map((m) => m.name).join(" + ")} · {fmt(s.kcal)} קק״ל · {s.protein} ג׳
                </button>
              ))}
            </div>
          )}

          {!skipped && alternatives.length > 0 && (
            <div className="stack">
              <span className="small muted">{entries.length ? "הוסף עוד" : prediction ? "במקום" : "בחר"}</span>
              <div className="chips">
                {alternatives.map((m) => (
                  <button key={m.id} className="chip" disabled={pending} onClick={() => run(() => logMeal({ slot, mealId: m.id }))}>
                    {m.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!skipped && <MorePicker slot={slot} meals={others} run={run} pending={pending} />}

          {!resolved && (
            <button className="btn ghost" disabled={pending} onClick={() => run(() => skipSlot(slot))}>דלג על {label}</button>
          )}
        </div>
      )}
    </section>
  );
}

function MorePicker({ slot, meals, run, pending }: { slot: Slot; meals: Meal[]; run: CardProps["run"]; pending: boolean }) {
  const [mode, setMode] = useState<"closed" | "library" | "manual">("closed");
  const [name, setName] = useState("");
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");

  if (mode === "closed") {
    return (
      <div className="row">
        <button className="btn grow" onClick={() => setMode("library")}>כל המאגר</button>
        <button className="btn grow" onClick={() => setMode("manual")}>משהו אחר</button>
      </div>
    );
  }
  if (mode === "library") {
    return (
      <label className="field">
        <span>בחר מהמאגר</span>
        <select
          defaultValue=""
          disabled={pending}
          onChange={(e) => e.target.value && run(() => logMeal({ slot, mealId: e.target.value }))}
        >
          <option value="" disabled>בחר ארוחה…</option>
          {meals.map((m) => (
            <option key={m.id} value={m.id}>{m.name} · {m.kcal} קק״ל · {m.protein} ג׳</option>
          ))}
        </select>
      </label>
    );
  }
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => logManual({ slot, name, kcal: Number(kcal), protein: Number(protein) }));
      }}
    >
      <label className="field"><span>מה אכלת</span><input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} /></label>
      <div className="row">
        <label className="field grow"><span>קלוריות</span><input inputMode="numeric" value={kcal} onChange={(e) => setKcal(e.target.value)} required /></label>
        <label className="field grow"><span>חלבון (ג׳)</span><input inputMode="numeric" value={protein} onChange={(e) => setProtein(e.target.value)} required /></label>
      </div>
      <button className="btn primary" disabled={pending}>שמור</button>
    </form>
  );
}
