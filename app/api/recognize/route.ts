import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@/lib/supabase/server";
import { normalizeRecognition } from "@/lib/recognition";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

const TOOL: Anthropic.Tool = {
  name: "report_meal",
  description: "Report the foods visible in the photo with estimated portions, calories and protein.",
  input_schema: {
    type: "object",
    properties: {
      dish: { type: "string", description: "Short Hebrew name for the whole meal" },
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Hebrew name of the food item" },
            grams: { type: ["number", "null"], description: "Estimated weight in grams" },
            kcal: { type: "number" },
            protein: { type: "number", description: "Grams of protein" },
          },
          required: ["name", "grams", "kcal", "protein"],
        },
      },
      matched_meal_id: {
        type: ["string", "null"],
        description: "id from the user's library if this photo is clearly that regular meal, else null",
      },
      confidence: { type: "number", description: "0–1, how confident the estimate is" },
      note: {
        type: ["string", "null"],
        description: "One short Hebrew sentence on the main uncertainty (e.g. hidden oil, sauce), or null",
      },
    },
    required: ["dish", "items", "matched_meal_id", "confidence", "note"],
  },
};

export async function POST(request: NextRequest) {
  const { supabase, user } = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "missing_key" }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as { image?: string } | null;
  const match = body?.image?.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return NextResponse.json({ error: "bad_image" }, { status: 400 });
  const [, mediaType, data] = match;
  if ((data.length * 3) / 4 > MAX_IMAGE_BYTES) return NextResponse.json({ error: "too_large" }, { status: 413 });

  const { data: meals } = await supabase
    .from("meals")
    .select("id,name,description,kcal,protein")
    .eq("archived", false);
  const library = (meals ?? []).map((m) => `- id=${m.id} | ${m.name} | ${m.description ?? ""} | ${m.kcal} kcal | ${m.protein} g protein`);

  const client = new Anthropic();
  try {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 1200,
      tools: [TOOL],
      tool_choice: { type: "tool", name: "report_meal" },
      system:
        "You estimate calories and protein from meal photos for a calorie-tracking app used in Israel. " +
        "Identify each food, estimate its weight from plate size and context, and give realistic values " +
        "including cooking oil and sauces you can reasonably infer. Use Hebrew names. " +
        "If the photo is clearly one of the user's regular meals from the library, set matched_meal_id. " +
        "If the photo shows no food, return an empty items list and confidence 0.",
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType as "image/jpeg", data } },
            {
              type: "text",
              text: `The user's regular meals:\n${library.join("\n") || "(none)"}\n\nReport this meal.`,
            },
          ],
        },
      ],
    });

    const call = res.content.find((c) => c.type === "tool_use");
    if (!call || call.type !== "tool_use") return NextResponse.json({ error: "no_result" }, { status: 502 });
    const recognition = normalizeRecognition(call.input, (meals ?? []).map((m) => m.id));
    return NextResponse.json({ recognition });
  } catch (err) {
    const status = err instanceof Anthropic.APIError ? err.status : undefined;
    console.error("recognize failed", status, err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: status === 401 ? "bad_key" : status === 429 ? "rate_limited" : "failed" },
      { status: 502 },
    );
  }
}
