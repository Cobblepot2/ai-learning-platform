import { apiError, requireAccount } from "@/lib/supabase/server";
import { enforceQuota } from "@/lib/ai/quota";
import { z } from "zod";
import { readLesson } from "@/lib/learning/repository";
import { MAX_CHARS, badRequest, describeLearner, generateJson, missingKey } from "@/lib/ai/gemini";

const Feedback = z.object({
  criteria: z
    .array(z.object({ met: z.boolean(), comment: z.string() }))
    .describe("One entry per rubric item, in the same order"),
  overall: z.string().describe("Two or three sentences of overall feedback"),
  improved_version: z.string().describe("A rewritten task description that meets every rubric item"),
});

export type PromptFeedback = z.infer<typeof Feedback> & { rubric: string[] };

export async function POST(req: Request) {
  try {
  const { db, user } = await requireAccount();
  const noKey = missingKey();
  if (noKey) return noKey;
  await enforceQuota(db, user.id, "prompt-lab");

  const { courseId, lessonId, blockId, profile, draft } = await req.json();
  const block = (await readLesson(courseId, lessonId))?.lesson.blocks.find((b) => b.id === blockId);
  if (block?.type !== "prompt-lab") return badRequest("Unknown exercise");
  if (typeof draft !== "string" || !draft.trim() || draft.length > MAX_CHARS) return badRequest("Invalid draft");

  const feedback = await generateJson({
    schema: Feedback,
    system: `You review task descriptions that students write for AI coding agents. Judge each rubric item strictly but kindly, and quote the student's own words in your comments. Write feedback in the learner's preferred language; keep the improved version in English.

<learner>
${describeLearner(profile)}
</learner>`,
    prompt: `Task the student was given: ${block.task}

Rubric:
${block.rubric.map((r, i) => `${i + 1}. ${r}`).join("\n")}

<student_draft>
${draft}
</student_draft>`,
  });

  if (!feedback) return Response.json({ error: "Could not review this draft." }, { status: 502 });
  const result: PromptFeedback = { ...feedback, rubric: block.rubric };
  return Response.json(result);
  } catch (error) { return apiError(error); }
}
