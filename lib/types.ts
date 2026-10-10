export type Slot = "breakfast" | "mid" | "lunch" | "afternoon" | "evening" | "night";

export const SLOTS: { id: Slot; label: string; time: string }[] = [
  { id: "breakfast", label: "בוקר", time: "08:00" },
  { id: "mid", label: "ביניים", time: "10:30" },
  { id: "lunch", label: "צהריים", time: "13:00" },
  { id: "afternoon", label: "אחה״צ", time: "16:00" },
  { id: "evening", label: "ערב", time: "20:00" },
  { id: "night", label: "לילה", time: "22:30" },
];

export type Meal = {
  id: string;
  name: string;
  description: string | null;
  kcal: number;
  protein: number;
  default_slot: Slot | null;
  has_vegetable: boolean;
  archived: boolean;
};

export type Variant = {
  id: string;
  meal_id: string;
  name: string;
  kcal_delta: number;
  protein_delta: number;
};

export type LogEntry = {
  id: string;
  eaten_on: string; // YYYY-MM-DD
  slot: Slot;
  meal_id: string | null;
  name: string;
  portion: number;
  kcal: number;
  protein: number;
  source: "library" | "photo" | "manual";
  status: "confirmed" | "skipped";
};

export type Phase = {
  kind: "cut" | "maintain" | "bulk";
  kcal_target: number;
  protein_target: number;
  started_on: string;
};
