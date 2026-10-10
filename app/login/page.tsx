"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

/**
 * Sign in with a one-time code sent by email.
 * The code is typed inside the app (not a link), so it also works from the
 * home-screen app on iPhone, which keeps its own storage separate from Safari.
 */
export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabaseBrowser().auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setBusy(false);
    if (error) {
      setError(error.status === 429 ? "נשלחו יותר מדי קודים. נסה שוב בעוד כמה דקות." : "לא הצלחנו לשלוח קוד. בדוק את הכתובת ונסה שוב.");
      return;
    }
    setStep("code");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabaseBrowser().auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email",
    });
    if (error) {
      setBusy(false);
      setError("הקוד לא נכון או שפג תוקפו.");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="page" style={{ justifyContent: "center", paddingBottom: 40 }}>
      <h1 className="title">התזונה שלי</h1>
      <p className="muted" style={{ margin: 0 }}>
        היום שלך מוכן מראש לפי מה שאתה אוכל בדרך כלל. מאשרים בלחיצה.
      </p>

      {step === "email" ? (
        <form className="stack" onSubmit={sendCode}>
          <label className="field">
            <span>כתובת מייל</span>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              dir="ltr"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <button className="btn primary block" disabled={busy} style={{ minHeight: 52 }}>
            {busy ? "שולח…" : "שלח לי קוד כניסה"}
          </button>
        </form>
      ) : (
        <form className="stack" onSubmit={verify}>
          <p className="small muted" style={{ margin: 0 }}>
            שלחנו קוד ל-<span dir="ltr">{email}</span>. הקלד אותו כאן.
          </p>
          <label className="field">
            <span>קוד</span>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6,10}"
              dir="ltr"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              style={{ fontSize: 22, letterSpacing: 4, textAlign: "center" }}
            />
          </label>
          <button className="btn primary block" disabled={busy} style={{ minHeight: 52 }}>
            {busy ? "בודק…" : "כניסה"}
          </button>
          <button type="button" className="btn ghost" onClick={() => { setStep("email"); setCode(""); setError(null); }}>
            כתובת אחרת / שלח שוב
          </button>
        </form>
      )}

      {error && <p role="alert" className="protein small" style={{ margin: 0 }}>{error}</p>}
    </main>
  );
}
