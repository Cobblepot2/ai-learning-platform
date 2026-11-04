import { z } from "zod";
import { enforceQuota } from "@/lib/ai/quota";
import { hasGeminiKey } from "@/lib/ai/gemini";
import { BUILT_IN_DRAFTS } from "@/lib/projects";
import { generateProject, MAX_INSTRUCTIONS, MAX_TEACHING, type ProjectRequest } from "@/lib/projects/generated/generate";
import { LEVELS } from "@/lib/projects/generated/profile";
import { loadOwnDraft, newGeneratedId, saveGeneratedProject } from "@/lib/projects/generated/store";
import { apiError, HttpError, requireAccount } from "@/lib/supabase/server";

/*
 * An instructor's project, written by the AI: from their own teaching
 * material, or by customising an existing project (a built-in one or their
 * own) along their instructions. The result is a new project they own.
 */
export const maxDuration = 300;

const bodySchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("create"),
    subject: z.string().trim().min(2).max(80),
    topic: z.string().trim().max(200).default(""),
    learners: z.string().trim().max(160).default(""),
    level: z.enum(LEVELS).optional(),
    teaching: z.string().trim().max(MAX_TEACHING).default(""),
    instructions: z.string().trim().max(MAX_INSTRUCTIONS).default(""),
  }),
  z.object({
    mode: z.literal("customise"),
    base: z.string().trim().min(1).max(64),
    instructions: z.string().trim().min(10).max(MAX_INSTRUCTIONS),
  }),
]);

export async function POST(req: Request) {
  try {
    const { db, user } = await requireAccount(true);
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "Give a subject to create a project, or say what to change (10 characters or more) to customise one.");
    if (!hasGeminiKey()) throw new HttpError(503, "Project generation is not available on this server.");
    const body = parsed.data;

    let request: ProjectRequest;
    let topic: string;
    if (body.mode === "create") {
      request = {
        domain: "",
        topic: body.topic,
        subject: body.subject,
        learner: body.learners || undefined,
        level: body.level,
        teaching: body.teaching || undefined,
        instructions: body.instructions || undefined,
      };
      topic = body.topic || `Learn ${body.subject}`;
    } else {
      const base = BUILT_IN_DRAFTS[body.base] ?? (await loadOwnDraft(body.base, user.id));
      if (!base) throw new HttpError(404, "That project doesn't exist.");
      request = { domain: base.domain, topic: "", base, instructions: body.instructions };
      topic = `From ${base.title}: ${body.instructions}`;
    }
    await enforceQuota(db, user.id, "generation");

    const started = Date.now();
    const id = newGeneratedId();
    const result = await generateProject(request, { id });
    if ("error" in result) {
      console.warn("Instructor project failed", { mode: body.mode, error: result.error, problems: result.check?.problems.slice(0, 5) });
      throw new HttpError(502, `${result.error} Try again, or simplify what you asked for.`);
    }
    await saveGeneratedProject(user.id, { ...request, topic: topic.slice(0, 200) }, result);
    console.info("Instructor project generated", { id, mode: body.mode, model: result.model, attempts: result.attempts, ms: Date.now() - started });
    return Response.json({ id, title: result.draft.title });
  } catch (error) {
    return apiError(error);
  }
}
