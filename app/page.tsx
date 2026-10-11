import { currentUser } from "@/lib/supabase/server";
import { loadDay } from "@/lib/data";
import { planDay, suggestForGap } from "@/lib/predict";
import { hebrewDayName } from "@/lib/dates";
import { redirect } from "next/navigation";
import Timeline from "./timeline";
import Nav from "./nav";
import PhotoCapture from "./photo";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { supabase, user } = await currentUser();
  if (!user) redirect("/login");

  const day = await loadDay(supabase);
  const plan = planDay({ today: day.today, meals: day.meals, entries: day.entries });

  const evening = plan.slots.find((s) => s.slot === "evening")!;
  const gap = {
    kcal: day.phase.kcal_target - plan.expected.kcal,
    protein: day.phase.protein_target - plan.expected.protein,
  };
  const suggestions =
    evening.entries.length === 0 && !evening.skipped && !evening.prediction
      ? suggestForGap(gap, day.meals, day.entries)
      : [];

  return (
    <>
      <Timeline
        dayName={hebrewDayName(day.today)}
        plan={plan}
        meals={day.meals.filter((m) => !m.archived)}
        variants={day.variants}
        targets={{ kcal: day.phase.kcal_target, protein: day.phase.protein_target }}
        suggestions={suggestions}
      />
      <PhotoCapture meals={day.meals.filter((m) => !m.archived)} />
      <Nav current="/" />
    </>
  );
}
