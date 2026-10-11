import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

/** Shown when the Supabase environment variables are missing on the server. */
export default function SetupPage() {
  const url = SUPABASE_URL;
  const key = SUPABASE_KEY;
  const rows = [
    { name: "NEXT_PUBLIC_SUPABASE_URL", ok: !!url && url.startsWith("https://"), hint: url ? (url.startsWith("https://") ? "" : "צריך להתחיל ב-https://") : "חסר" },
    { name: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", ok: !!key, hint: key ? "" : "חסר" },
  ];
  return (
    <main className="page" style={{ paddingBottom: 40 }}>
      <h1 className="title">חסרה הגדרה</h1>
      <p className="muted" style={{ margin: 0 }}>
        האפליקציה לא מוצאת את פרטי החיבור ל-Supabase. ב-Vercel: Settings ← Environment Variables, ואחר כך Redeploy.
      </p>
      <div className="card stack">
        {rows.map((r) => (
          <div key={r.name} className="row between small">
            <span dir="ltr" style={{ fontFamily: "monospace" }}>{r.name}</span>
            <b style={{ color: r.ok ? "var(--green)" : "var(--protein)" }}>{r.ok ? "תקין" : r.hint}</b>
          </div>
        ))}
      </div>
    </main>
  );
}
