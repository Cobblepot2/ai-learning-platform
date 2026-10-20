import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { getLesson } from "@/content/courses";
import { FALLBACK, MAX_CHARS, MODEL, badRequest, describeLearner, getClient, missingKey } from "@/lib/ai/claude";

const Feedback = z.object({
  criteria: z
    .array(z.object({ met: z.boolean(), comment: z.string() }))
    .describe("One entry per rubric item, in the same order"),
  overall: z.string().describe("Two or three sentences of overall feedback"),
  improved_version: z.string().describe("A rewritten task description that meets every rubric item"),
});

export type PromptFeedback = z.infer<typeof Feedback> & { rubric: string[] };

export async function POST(req: Request) {
  const noKey = missingKey();
  if (noKey) return noKey;

  const { courseId, lessonId, blockId, profile, draft } = await req.json();
  const block = getLesson(courseId, lessonId)?.lesson.blocks.find((b) => b.id === blockId);
  if (block?.type !== "prompt-lab") return badRequest("Unknown exercise");
  if (typeof draft !== "string" || !draft.trim() || draft.length > MAX_CHARS) return badRequest("Invalid draft");

  const response = await getClient().beta.messages.parse({
    model: MODEL,
    max_tokens: 4000,
    output_config: { effort: "medium", format: betaZodOutputFormat(Feedback) },
    system: `You review task descriptions that students write for AI coding agents. Judge each rubric item strictly but kindly, and quote the student's own words in your comments. Write feedback in the learner's preferred language; keep the improved version in English.

<learner>
${describeLearner(profile)}
</learner>`,
    messages: [
      {
        role: "user",
        content: `Task the student was given: ${block.task}

Rubric:
${block.rubric.map((r, i) => `${i + 1}. ${r}`).join("\n")}

<student_draft>
${draft}
</student_draft>`,
      },
    ],
    ...FALLBACK,
  });

  if (!response.parsed_output) return Response.json({ error: "Could not review this draft." }, { status: 502 });
  const result: PromptFeedback = { ...response.parsed_output, rubric: block.rubric };
  return Response.json(result);
}
