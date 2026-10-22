import { z } from "zod";
import { requireAccount, apiError, HttpError } from "@/lib/supabase/server";
import { goalsSchema, outlineSchema } from "@/lib/learning/model";
import { activitySchema } from "@/lib/learning/registry";
import {
  designSimulation,
  generateOutline,
  generateLesson,
  refineActivity,
  simulationDesignSchema,
} from "@/lib/learning/generation";
import { missingKey } from "@/lib/ai/gemini";
import { enforceQuota } from "@/lib/ai/quota";
export async function POST(req: Request) {
  try {
    const { db, user } = await requireAccount();
    const missing = missingKey();
    if (missing) return missing;
    await enforceQuota(db, user.id, "generation");
    const body = await req.json();
    let proposal;
    if (body.action === "outline")
      proposal = await generateOutline(goalsSchema.parse(body.goals));
    else if (body.action === "lesson") {
      const outline = outlineSchema.parse(body.outline);
      const index = z
        .number()
        .int()
        .min(0)
        .max(outline.lessons.length - 1)
        .parse(body.index);
      proposal = await generateLesson(
        goalsSchema.parse(body.goals),
        outline,
        index,
      );
    } else if (body.action === "refine") {
      proposal = await refineActivity(
        activitySchema.parse(body.activity),
        z.string().min(1).max(3000).parse(body.instruction),
        goalsSchema.parse(body.goals),
      );
    } else if (body.action === "simulation") {
      proposal = await designSimulation(
        simulationDesignSchema.parse(body.request ?? body),
      );
    } else throw new HttpError(400, "Unknown generation step.");
    if (!proposal)
      throw new HttpError(
        502,
        "The AI returned an unsupported or incomplete structure. Retry or edit manually.",
      );
    return Response.json(proposal);
  } catch (e) {
    return apiError(e);
  }
}
