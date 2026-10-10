import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/supabase/server";
import { SLOTS, type Meal } from "@/lib/types";
import Nav from "../nav";
import { archiveMeal, saveMeal } from "../actions";

export const dynamic = "force-dynamic";

export default async function MealsPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { supabase, user } = await currentUser();
  if (!user) redirect("/login");
  const { edit } = await searchParams;

  const { data } = await supabase
    .from("meals")
    .select("id,name,description,kcal,protein,default_slot,has_vegetable,archived")
    .eq("archived", false)
    .order("created_at");
  const meals = (data ?? []) as Meal[];
  const editing = edit ? meals.find((m) => m.id === edit) ?? null : null;

  return (
    <>
      <main className="page">
        <h1 className="title">המאגר שלי</h1>

        {[...SLOTS, { id: null, label: "לא קבוע" }].map(({ id, label }) => {
          const group = meals.filter((m) => m.default_slot === id);
          if (!group.length) return null;
          return (
            <section key={id ?? "none"} className="stack" aria-label={label}>
              <h2 className="h2">{label}</h2>
              {group.map((m) => (
                <div key={m.id} className="card row">
                  <div className="grow">
                    <div className="meal-name">{m.name}</div>
                    <div className="small muted">
                      {m.kcal} קק״ל · {m.protein} ג׳{m.has_vegetable ? " · עם ירק" : ""}
                      {m.description ? ` · ${m.description}` : ""}
                    </div>
                  </div>
                  <Link className="btn ghost" href={`/meals?edit=${m.id}#form`} style={{ display: "inline-flex", alignItems: "center" }}>
                    ערוך
                  </Link>
                </div>
              ))}
            </section>
          );
        })}

        <section id="form" className="card stack" aria-label={editing ? "עריכת ארוחה" : "ארוחה חדשה"}>
          <h2 className="h2">{editing ? `עריכה: ${editing.name}` : "ארוחה חדשה"}</h2>
          <form action={saveMeal} className="stack">
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <label className="field"><span>שם</span><input name="name" required maxLength={80} defaultValue={editing?.name} /></label>
            <label className="field"><span>מה יש בה</span><input name="description" maxLength={200} defaultValue={editing?.description ?? ""} /></label>
            <div className="row">
              <label className="field grow"><span>קלוריות</span><input name="kcal" inputMode="numeric" required defaultValue={editing?.kcal} /></label>
              <label className="field grow"><span>חלבון (ג׳)</span><input name="protein" inputMode="numeric" required defaultValue={editing?.protein} /></label>
            </div>
            <label className="field">
              <span>מתי בדרך כלל</span>
              <select name="default_slot" defaultValue={editing?.default_slot ?? ""}>
                <option value="">לא קבוע</option>
                {SLOTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </label>
            <label className="row small" style={{ minHeight: 44 }}>
              <input type="checkbox" name="has_vegetable" defaultChecked={editing?.has_vegetable} style={{ width: 22, height: 22 }} />
              כוללת ירק
            </label>
            <button className="btn primary">{editing ? "שמור שינויים" : "הוסף למאגר"}</button>
          </form>
          {editing && (
            <form action={archiveMeal.bind(null, editing.id)}>
              <button className="btn ghost block">הסר מהמאגר</button>
            </form>
          )}
        </section>
      </main>
      <Nav current="/meals" />
    </>
  );
}
