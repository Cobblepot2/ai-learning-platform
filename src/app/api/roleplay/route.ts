import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { getLesson } from "@/content/courses";
import {
  FALLBACK,
  MODEL,
  badRequest,
  describeLearner,
  getClient,
  missingKey,
  streamText,
  toMessages,
} from "@/lib/ai/claude";
import type { RoleplayBlock } from "@/lib/types";

const Debrief = z.object({
  uncovered: z.array(z.number().int()).describe("0-based indexes of hidden requirements the learner uncovered"),
  strengths: z.array(z.string()).describe("2-3 specific things the learner did well, quoting their questions"),
  improvements: z.array(z.string()).describe("2-3 specific, actionable suggestions"),
  example_question: z.string().describe("One strong question they could have asked next"),
  summary: z.string().describe("One or two encouraging sentences"),
});

export type DebriefResult = z.infer<typeof Debrief> & { total: number; requirements: string[] };

function findBlock(courseId: string, lessonId: string, blockId: string): RoleplayBlock | null {
  const block = getLesson(courseId, lessonId)?.lesson.blocks.find((b) => b.id === blockId);
  return block?.type === "roleplay" ? block : null;
}

export async function POST(req: Request) {
  const noKey = missingKey();
  if (noKey) return noKey;

  const { courseId, lessonId, blockId, profile, messages, mode } = await req.json();
  const block = findBlock(courseId, lessonId, blockId);
  if (!block) return badRequest("Unknown role-play");

  // The opening line comes from the course content, so the conversation starts with the persona.
  const history = toMessages(
    [
      { role: "user", content: "(The interview begins.)" },
      { role: "assistant", content: block.openingLine },
      ...(Array.isArray(messages) ? messages : []),
    ],
    { requireUserLast: mode !== "debrief" },
  );
  if (!history) return badRequest("Invalid messages");

  const hidden = block.hiddenRequirements.map((r, i) => `${i}. ${r}`).join("\n");

  if (mode === "debrief") {
    const transcript = history
      .slice(1)
      .map((m) => `${m.role === "user" ? "LEARNER" : "CLIENT"}: ${m.content}`)
      .join("\n");

    const response = await getClient().beta.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      output_config: { effort: "medium", format: betaZodOutputFormat(Debrief) },
      system: `You coach students on requirements-gathering interviews. Be honest, specific and encouraging. Write in the learner's preferred language.

<learner>
${describeLearner(profile)}
</learner>`,
      messages: [
        {
          role: "user",
          content: `Scenario: ${block.scenario}

Hidden requirements the learner was supposed to uncover:
${hidden}

A requirement counts as uncovered only if the client actually revealed it in the transcript because of the learner's questions.

<transcript>
${transcript}
</transcript>`,
        },
      ],
      ...FALLBACK,
    });

    if (!response.parsed_output) return Response.json({ error: "Could not evaluate this interview." }, { status: 502 });
    const result: DebriefResult = {
      ...response.parsed_output,
      uncovered: response.parsed_output.uncovered.filter((i) => i >= 0 && i < block.hiddenRequirements.length),
      total: block.hiddenRequirements.length,
      requirements: block.hiddenRequirements,
    };
    return Response.json(result);
  }

  const system = `You are playing a character in a requirements-interview exercise for students learning software engineering.

<character>
${block.persona}
</character>

<hidden_details>
${hidden}
</hidden_details>

Rules:
- Stay in character at all times. Never mention that you are an AI, the exercise or the hidden details list.
- Reveal a hidden detail only when the student asks a question that reasonably leads to it. Vague questions get vague answers.
- Keep each reply to 1-4 sentences, like real speech.
- If the student proposes a technical solution, react as a non-technical client would (ask what it means, or what it costs).
- The student's preferred language is: ${profile?.language === "zh" ? "Cantonese-flavoured Traditional Chinese" : "English"}. Reply in that language.`;

  return streamText({ system, messages: history, effort: "low", maxTokens: 1000 });
}
