"use client";

import { useState } from "react";
import type { DaySummary } from "@/lib/history";
import { SLOTS } from "@/lib/types";

const W = 400;
const H = 150;
const PAD = { top: 14, bottom: 22, left: 4, right: 4 };
const fmt = (n: number) => n.toLocaleString("he-IL");
const shortDate = (d: string) => `${Number(d.slice(8, 10))}.${Number(d.slice(5, 7))}`;
const SLOT_LABEL = Object.fromEntries(SLOTS.map((s) => [s.id, s.label]));

/** Bar with a rounded top (data end) and a flat base. */
function barPath(x: number, y: number, w: number, h: number) {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

function BarChart({
  days,
  value,
  target,
  color,
  unit,
  label,
  selected,
  onSelect,
  today,
}: {
  days: DaySummary[];
  value: (d: DaySummary) => number;
  target: (d: DaySummary) => number;
  color: string;
  unit: string;
  label: string;
  selected: string | null;
  onSelect: (d: string) => void;
  today: string;
}) {
  const max = Math.max(1, ...days.map(value), ...days.map(target)) * 1.08;
  const plotH = H - PAD.top - PAD.bottom;
  const step = (W - PAD.left - PAD.right) / days.length;
  const barW = Math.max(3, step - 2); // 2px surface gap between bars
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;
  const labelEvery = days.length <= 7 ? 1 : days.length <= 14 ? 2 : 5;

  // Target as a step line (targets can change between phases).
  const targetPath = days
    .map((d, i) => {
      const x0 = PAD.left + i * step;
      const ty = y(target(d));
      return `${i === 0 ? "M" : "L"}${x0},${ty}H${x0 + step}`;
    })
    .join("");
  const lastTarget = target(days[days.length - 1]);

  return (
    <figure className="card stack" style={{ margin: 0, gap: 6 }}>
      <figcaption className="row between small">
        <b>{label}</b>
        <span className="muted">קו מקווקו: יעד ({fmt(lastTarget)} {unit})</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${label} לפי יום`} style={{ direction: "ltr", display: "block" }}>
        <line x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} stroke="var(--line-strong)" strokeWidth="1" />
        {days.map((d, i) => {
          const v = value(d);
          const x = PAD.left + i * step + (step - barW) / 2;
          return (
            <g key={d.date}>
              {d.logged && v > 0 && (
                <path
                  d={barPath(x, y(v), barW, y(0) - y(v))}
                  fill={color}
                  opacity={d.date === today ? 0.45 : 1}
                />
              )}
              {i % labelEvery === 0 || i === days.length - 1 ? (
                <text x={x + barW / 2} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--muted)">
                  {shortDate(d.date)}
                </text>
              ) : null}
              {/* Hit target: the full column, larger than the bar. */}
              <rect
                x={PAD.left + i * step}
                y={0}
                width={step}
                height={H}
                fill="transparent"
                style={{ cursor: "pointer" }}
                onClick={() => onSelect(d.date)}
              >
                <title>{`${shortDate(d.date)} · ${d.logged ? `${fmt(v)} ${unit}` : "לא נרשם"}`}</title>
              </rect>
            </g>
          );
        })}
        <path d={targetPath} fill="none" stroke="var(--ink)" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.55" pointerEvents="none" />
        {selected && (() => {
          const i = days.findIndex((d) => d.date === selected);
          if (i < 0) return null;
          const cx = PAD.left + i * step + step / 2;
          return <line x1={cx} x2={cx} y1={PAD.top - 6} y2={y(0)} stroke="var(--ink)" strokeWidth="1" opacity="0.35" pointerEvents="none" />;
        })()}
      </svg>
    </figure>
  );
}

export default function HistoryCharts({ days, today }: { days: DaySummary[]; today: string }) {
  // Open on the last full day logged (today is still in progress).
  const lastLogged =
    [...days].reverse().find((d) => d.logged && d.date !== today)?.date ?? days.find((d) => d.date === today && d.logged)?.date ?? null;
  const [selected, setSelected] = useState<string | null>(lastLogged);
  const sel = days.find((d) => d.date === selected) ?? null;

  return (
    <>
      <BarChart
        days={days}
        value={(d) => d.kcal}
        target={(d) => d.kcalTarget}
        color="var(--green)"
        unit="קק״ל"
        label="קלוריות"
        selected={selected}
        onSelect={setSelected}
        today={today}
      />
      <BarChart
        days={days}
        value={(d) => d.protein}
        target={(d) => d.proteinTarget}
        color="var(--protein-bar)"
        unit="ג׳"
        label="חלבון"
        selected={selected}
        onSelect={setSelected}
        today={today}
      />

      {sel && (
        <section className="card stack" aria-live="polite" aria-label="פירוט היום שנבחר">
          <div className="row between">
            <b>{sel.date === today ? "היום (עדיין פתוח)" : `${shortDate(sel.date)}`}</b>
            <span className="small muted">
              {fmt(sel.kcal)} / {fmt(sel.kcalTarget)} קק״ל · <span className="protein">{sel.protein} / {sel.proteinTarget} ג׳</span>
            </span>
          </div>
          {sel.entries.length === 0 ? (
            <span className="small muted">לא נרשם כלום ביום הזה.</span>
          ) : (
            sel.entries.map((e) => (
              <div key={e.id} className="row between small">
                <span>
                  <span className="muted">{SLOT_LABEL[e.slot]} · </span>
                  {e.name}
                  {e.source === "photo" ? " (תמונה)" : ""}
                </span>
                <span className="muted">{fmt(e.kcal)} · {e.protein} ג׳</span>
              </div>
            ))
          )}
        </section>
      )}
    </>
  );
}
