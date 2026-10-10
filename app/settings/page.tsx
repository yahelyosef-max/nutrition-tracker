import { redirect } from "next/navigation";
import { currentUser } from "@/lib/supabase/server";
import { loadDay } from "@/lib/data";
import Nav from "../nav";
import { saveTargets, signOut } from "../actions";

export const dynamic = "force-dynamic";

const KINDS = [
  { id: "cut", label: "גרעון" },
  { id: "maintain", label: "שמירה" },
  { id: "bulk", label: "עלייה במסה" },
];

export default async function SettingsPage() {
  const { supabase, user } = await currentUser();
  if (!user) redirect("/login");
  const { phase } = await loadDay(supabase);

  return (
    <>
      <main className="page">
        <h1 className="title">יעדים</h1>
        <form action={saveTargets} className="card stack">
          <label className="field">
            <span>שלב</span>
            <select name="kind" defaultValue={phase.kind}>
              {KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
            </select>
          </label>
          <div className="row">
            <label className="field grow"><span>קלוריות ליום</span><input name="kcal_target" inputMode="numeric" required defaultValue={phase.kcal_target} /></label>
            <label className="field grow"><span>חלבון ליום (ג׳)</span><input name="protein_target" inputMode="numeric" required defaultValue={phase.protein_target} /></label>
          </div>
          <p className="small muted" style={{ margin: 0 }}>שינוי נשמר כשלב חדש מהיום, וההיסטוריה נשמרת.</p>
          <button className="btn primary">שמור יעדים</button>
        </form>

        <div className="card stack">
          <span className="small muted">מחובר כ-{user.email}</span>
          <form action={signOut}><button className="btn block">התנתק</button></form>
        </div>
      </main>
      <Nav current="/settings" />
    </>
  );
}
