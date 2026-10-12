"use client";

import { useRef, useState, useTransition } from "react";
import { SLOTS, type Meal, type Slot } from "@/lib/types";
import { slotForTime, type Recognition } from "@/lib/recognition";
import { exifDateTaken } from "@/lib/exif";
import { daysBefore, hebrewDayName, localDate } from "@/lib/dates";
import { logPhoto } from "./actions";

const MAX_SIDE = 1280;
const MAX_FILES = 10;

/** When the photo was taken, in Israel time: EXIF date, else the file's date, else now. */
async function takenAt(file: File, fromCamera: boolean): Promise<{ date: string; time: string }> {
  const now = new Date();
  if (!fromCamera) {
    try {
      const exif = exifDateTaken(await file.slice(0, 256 * 1024).arrayBuffer());
      if (exif) return { date: exif.slice(0, 10), time: exif.slice(11, 16) };
    } catch {
      // fall through
    }
  }
  const at = !fromCamera && file.lastModified ? new Date(file.lastModified) : now;
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit", hour12: false }).format(at);
  return { date: localDate(at), time };
}

/** Downscale to a JPEG data URL: smaller upload, lower recognition cost, HEIC → JPEG. */
async function toJpeg(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

const ERRORS: Record<string, string> = {
  missing_key: "זיהוי תמונות עוד לא הוגדר (חסר מפתח Claude API ב-Vercel).",
  bad_key: "מפתח ה-Claude API לא תקין. בדוק אותו ב-Vercel.",
  rate_limited: "יותר מדי בקשות כרגע. נסה שוב בעוד דקה.",
  too_large: "התמונה גדולה מדי.",
  unauthorized: "צריך להתחבר מחדש.",
};

type Item = { file: File; fromCamera: boolean };

type Phase =
  | { kind: "idle" }
  | { kind: "working"; preview: string }
  | { kind: "review"; preview: string; r: Recognition }
  | { kind: "error"; preview?: string; message: string };

export default function PhotoCapture({ meals }: { meals: Meal[] }) {
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [queue, setQueue] = useState<Item[]>([]);
  const [index, setIndex] = useState(0);
  const [saved, setSaved] = useState(0);
  const [pending, start] = useTransition();

  // Review form state
  const [slot, setSlot] = useState<Slot>("breakfast");
  const [day, setDay] = useState(localDate());
  const [name, setName] = useState("");
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const [useLibrary, setUseLibrary] = useState(false);
  const [saveToLibrary, setSaveToLibrary] = useState(false);

  const matched = phase.kind === "review" && phase.r.matchedMealId ? meals.find((m) => m.id === phase.r.matchedMealId) ?? null : null;
  const today = localDate();
  const oldest = daysBefore(today, 7);
  const dayOptions = Array.from({ length: 8 }, (_, i) => daysBefore(today, i));

  function begin(files: FileList | null, fromCamera: boolean) {
    const list = Array.from(files ?? []).filter((f) => f.type.startsWith("image/") || f.type === "").slice(0, MAX_FILES);
    if (list.length === 0) return;
    const items = list.map((file) => ({ file, fromCamera }));
    setQueue(items);
    setIndex(0);
    setSaved(0);
    process(items[0]);
  }

  async function process(item: Item) {
    setPhase({ kind: "working", preview: "" });
    const when = await takenAt(item.file, item.fromCamera);
    let image: string;
    try {
      image = await toJpeg(item.file);
    } catch {
      setPhase({ kind: "error", message: "לא הצלחנו לקרוא את התמונה." });
      return;
    }
    setPhase({ kind: "working", preview: image });
    try {
      const res = await fetch("/api/recognize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.recognition) {
        setPhase({ kind: "error", preview: image, message: ERRORS[json.error] ?? "הזיהוי נכשל. נסה שוב או הזן ידנית." });
        return;
      }
      const r = json.recognition as Recognition;
      if (r.items.length === 0) {
        setPhase({ kind: "error", preview: image, message: "לא זיהינו אוכל בתמונה." });
        return;
      }
      const lib = r.matchedMealId ? meals.find((m) => m.id === r.matchedMealId) : undefined;
      setDay(when.date >= oldest && when.date <= today ? when.date : today);
      setSlot(slotForTime(when.time));
      setName(r.dish);
      setKcal(String(r.kcal));
      setProtein(String(r.protein));
      setUseLibrary(!!lib);
      setSaveToLibrary(false);
      setPhase({ kind: "review", preview: image, r });
    } catch {
      setPhase({ kind: "error", preview: image, message: "אין חיבור. נסה שוב." });
    }
  }

  function next(didSave: boolean) {
    const done = saved + (didSave ? 1 : 0);
    setSaved(done);
    const i = index + 1;
    if (i < queue.length) {
      setIndex(i);
      process(queue[i]);
    } else {
      close();
    }
  }

  function close() {
    setPhase({ kind: "idle" });
    setQueue([]);
    setIndex(0);
    if (camera.current) camera.current.value = "";
    if (gallery.current) gallery.current.value = "";
  }

  function save() {
    start(async () => {
      try {
        if (useLibrary && matched) {
          await logPhoto({ slot, eatenOn: day, name: matched.name, kcal: matched.kcal, protein: matched.protein, mealId: matched.id });
        } else {
          await logPhoto({ slot, eatenOn: day, name, kcal: Number(kcal), protein: Number(protein), saveToLibrary });
        }
        next(true);
      } catch {
        setPhase({ kind: "error", message: "השמירה נכשלה. נסה שוב." });
      }
    });
  }

  const multi = queue.length > 1;
  const counter = multi ? `תמונה ${index + 1} מתוך ${queue.length}` : null;
  const dayLabel = (d: string) => (d === today ? "היום" : d === daysBefore(today, 1) ? "אתמול" : hebrewDayName(d));

  return (
    <>
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => begin(e.target.files, true)} />
      <input ref={gallery} type="file" accept="image/*" multiple hidden onChange={(e) => begin(e.target.files, false)} />

      <div
        style={{
          position: "fixed",
          insetInline: 16,
          bottom: "calc(72px + env(safe-area-inset-bottom))",
          maxWidth: 448,
          margin: "0 auto",
          display: "flex",
          gap: 10,
          zIndex: 5,
        }}
      >
        <button
          className="btn primary grow"
          onClick={() => camera.current?.click()}
          style={{ minHeight: 54, borderRadius: 16, fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 6px 20px rgba(28,31,26,0.18)" }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          צלם ארוחה
        </button>
        <button
          className="btn"
          onClick={() => gallery.current?.click()}
          style={{ minHeight: 54, borderRadius: 16, fontSize: 15, background: "var(--card)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 6px 20px rgba(28,31,26,0.12)" }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <circle cx="9" cy="10" r="2" />
            <path d="M21 16l-5-5-8 8" />
          </svg>
          מהגלריה
        </button>
      </div>

      {phase.kind !== "idle" && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="ארוחה מצולמת"
          style={{ position: "fixed", inset: 0, background: "rgba(28,31,26,0.45)", zIndex: 20, display: "flex", alignItems: "flex-end" }}
        >
          <div
            className="stack"
            style={{
              background: "var(--ground)",
              width: "100%",
              maxWidth: 480,
              margin: "0 auto",
              maxHeight: "92dvh",
              overflowY: "auto",
              borderRadius: "20px 20px 0 0",
              padding: "16px 16px calc(20px + env(safe-area-inset-bottom))",
              gap: 12,
            }}
          >
            {counter && <span className="small muted" role="status">{counter}</span>}

            {"preview" in phase && phase.preview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={phase.preview} alt="" style={{ width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 14 }} />
            )}

            {phase.kind === "working" && <p className="h2" style={{ textAlign: "center" }} role="status">מזהה את הארוחה…</p>}

            {phase.kind === "error" && (
              <>
                <p role="alert" style={{ margin: 0 }}>{phase.message}</p>
                <div className="row">
                  {queue[index] && (
                    <button className="btn primary grow" onClick={() => process(queue[index])}>נסה שוב</button>
                  )}
                  {multi && index + 1 < queue.length ? (
                    <button className="btn grow" onClick={() => next(false)}>דלג לתמונה הבאה</button>
                  ) : (
                    <button className="btn grow" onClick={close}>סגור</button>
                  )}
                </div>
              </>
            )}

            {phase.kind === "review" && (
              <>
                <h2 className="h2">{phase.r.dish}</h2>

                {matched && (
                  <div className="card stack" style={{ background: "var(--green-soft)", border: 0 }}>
                    <span className="small">זו נראית כמו <b>{matched.name}</b> מהמאגר ({matched.kcal} קק״ל · {matched.protein} ג׳).</span>
                    <div className="row">
                      <button className={`btn grow${useLibrary ? " primary" : ""}`} onClick={() => setUseLibrary(true)}>ערכי המאגר</button>
                      <button className={`btn grow${!useLibrary ? " primary" : ""}`} onClick={() => setUseLibrary(false)}>לפי התמונה</button>
                    </div>
                  </div>
                )}

                {!(useLibrary && matched) && (
                  <>
                    <div className="card stack" style={{ gap: 6 }}>
                      {phase.r.items.map((it, i) => (
                        <div key={i} className="row between small">
                          <span>{it.name}{it.grams ? ` · ~${it.grams} ג׳` : ""}</span>
                          <span className="muted">{it.kcal} קק״ל · {it.protein} ג׳</span>
                        </div>
                      ))}
                      {phase.r.note && <span className="small muted">{phase.r.note}</span>}
                    </div>
                    <label className="field"><span>שם</span><input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></label>
                    <div className="row">
                      <label className="field grow"><span>קלוריות</span><input inputMode="numeric" value={kcal} onChange={(e) => setKcal(e.target.value.replace(/\D/g, ""))} /></label>
                      <label className="field grow"><span>חלבון (ג׳)</span><input inputMode="numeric" value={protein} onChange={(e) => setProtein(e.target.value.replace(/\D/g, ""))} /></label>
                    </div>
                    <label className="row small" style={{ minHeight: 44 }}>
                      <input type="checkbox" checked={saveToLibrary} onChange={(e) => setSaveToLibrary(e.target.checked)} style={{ width: 22, height: 22 }} />
                      שמור גם במאגר כארוחה קבועה
                    </label>
                  </>
                )}

                <div className="row">
                  <label className="field grow">
                    <span>יום</span>
                    <select value={day} onChange={(e) => setDay(e.target.value)}>
                      {dayOptions.map((d) => <option key={d} value={d}>{dayLabel(d)}</option>)}
                    </select>
                  </label>
                  <label className="field grow">
                    <span>ארוחה</span>
                    <select value={slot} onChange={(e) => setSlot(e.target.value as Slot)}>
                      {SLOTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                  </label>
                </div>

                {phase.r.confidence < 0.5 && !(useLibrary && matched) && (
                  <p className="small protein" style={{ margin: 0 }}>ההערכה פחות בטוחה. כדאי לבדוק את המספרים.</p>
                )}

                <div className="row">
                  <button className="btn primary grow" disabled={pending || (!useLibrary && !kcal)} onClick={save} style={{ minHeight: 50 }}>
                    {pending ? "שומר…" : multi && index + 1 < queue.length ? "רשום והמשך" : "רשום"}
                  </button>
                  <button className="btn" onClick={() => (multi ? next(false) : close())} disabled={pending}>
                    {multi ? "דלג" : "ביטול"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
