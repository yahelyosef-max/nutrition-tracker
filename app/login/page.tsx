"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

/**
 * Email + password sign-in, done entirely inside the app so it also works from
 * the iPhone home-screen app (whose storage is separate from Safari).
 * The iPhone password manager fills and saves the password automatically.
 */
export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    const auth = supabaseBrowser().auth;

    if (mode === "signup") {
      const { data, error } = await auth.signUp({ email: email.trim(), password });
      setBusy(false);
      if (error) {
        setError(
          error.message.toLowerCase().includes("signups not allowed")
            ? "ההרשמה סגורה. בקש מהמנהל לפתוח אותה."
            : error.message.toLowerCase().includes("password")
              ? "הסיסמה חלשה מדי. נסה לפחות 8 תווים."
              : "ההרשמה נכשלה. נסה שוב.",
        );
        return;
      }
      if (!data.session) {
        setNotice("נשלח אליך מייל לאישור. אשר אותו, חזור לכאן והתחבר.");
        setMode("signin");
        return;
      }
    } else {
      const { error } = await auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        setBusy(false);
        setError(
          error.message.toLowerCase().includes("not confirmed")
            ? "צריך קודם לאשר את המייל שנשלח אליך."
            : "המייל או הסיסמה לא נכונים.",
        );
        return;
      }
    }
    router.replace("/");
    router.refresh();
  }

  const signup = mode === "signup";

  return (
    <main className="page" style={{ justifyContent: "center", paddingBottom: 40 }}>
      <h1 className="title">התזונה שלי</h1>
      <p className="muted" style={{ margin: 0 }}>
        היום שלך מוכן מראש לפי מה שאתה אוכל בדרך כלל. מאשרים בלחיצה.
      </p>

      <form className="stack" onSubmit={submit}>
        <label className="field">
          <span>מייל</span>
          <input
            type="email"
            inputMode="email"
            autoComplete="username"
            dir="ltr"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="field">
          <span>סיסמה</span>
          <input
            type="password"
            autoComplete={signup ? "new-password" : "current-password"}
            dir="ltr"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button className="btn primary block" disabled={busy} style={{ minHeight: 52 }}>
          {busy ? "רגע…" : signup ? "יצירת חשבון" : "כניסה"}
        </button>
      </form>

      <button
        type="button"
        className="btn ghost"
        onClick={() => { setMode(signup ? "signin" : "signup"); setError(null); setNotice(null); }}
      >
        {signup ? "יש לי חשבון — כניסה" : "פעם ראשונה? יצירת חשבון"}
      </button>

      {notice && <p role="status" className="small" style={{ margin: 0 }}>{notice}</p>}
      {error && <p role="alert" className="protein small" style={{ margin: 0 }}>{error}</p>}
    </main>
  );
}
