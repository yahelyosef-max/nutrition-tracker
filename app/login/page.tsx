"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function LoginPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setBusy(true);
    setError(null);
    const { error } = await supabaseBrowser().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError("הכניסה נכשלה. נסה שוב.");
      setBusy(false);
    }
  }

  return (
    <main className="page" style={{ justifyContent: "center", paddingBottom: 40 }}>
      <h1 className="title">התזונה שלי</h1>
      <p className="muted" style={{ margin: 0 }}>
        היום שלך מוכן מראש לפי מה שאתה אוכל בדרך כלל. מאשרים בלחיצה.
      </p>
      <button className="btn primary block" onClick={signIn} disabled={busy} style={{ minHeight: 52 }}>
        {busy ? "מתחבר…" : "כניסה עם Google"}
      </button>
      {error && <p role="alert" className="protein small">{error}</p>}
    </main>
  );
}
