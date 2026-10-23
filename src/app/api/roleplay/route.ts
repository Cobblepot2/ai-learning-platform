import { apiError, requireAccount } from "@/lib/supabase/server";
import { enforceQuota } from "@/lib/ai/quota";
import { z } from "zod";
import { readLesson } from "@/lib/learning/repository";
import { badRequest, describeLearner, generateJson, missingKey, streamText, toContents } from "@/lib/ai/gemini";
import { normalizeProfile, preferredLanguageName } from "@/lib/learner/preferences";
import type { RoleplayBlock } from "@/lib/types";

const Debrief = z.object({
  uncovered: z.array(z.number().int()).describe("0-based indexes of hidden requirements the learner uncovered"),
  strengths: z.array(z.string()).describe("2-3 specific things the learner did well, quoting their questions"),
  improvements: z.array(z.string()).describe("2-3 specific, actionable suggestions"),
  example_question: z.string().describe("One strong question they could have asked next"),
  summary: z.string().describe("One or two encouraging sentences"),
});

export type DebriefResult = z.infer<typeof Debrief> & { total: number; requirements: string[] };

async function findBlock(courseId: string, lessonId: string, blockId: string): Promise<RoleplayBlock | null> {
  const block = (await readLesson(courseId, lessonId))?.lesson.blocks.find((b) => b.id === blockId);
  return block?.type === "roleplay" ? block : null;
}

export async function POST(req: Request) {
  try {
  const { db, user } = await requireAccount();
  const noKey = missingKey();
  if (noKey) return noKey;
  await enforceQuota(db, user.id, "roleplay");

  const { courseId, lessonId, blockId, profile, messages, mode } = await req.json();
  const learner = profile == null ? null : normalizeProfile(profile);
  const block = await findBlock(courseId, lessonId, blockId);
  if (!block) return badRequest("Unknown role-play");

  // The opening line comes from the course content, so the conversation starts with the persona.
  const history = toContents(
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
      .map((m) => `${m.role === "user" ? "LEARNER" : "CLIENT"}: ${m.parts?.[0]?.text ?? ""}`)
      .join("\n");

    const debrief = await generateJson({
      schema: Debrief,
      system: `You coach students on the supplied roleplay scenario and its learning goals. Be honest, specific and encouraging. Write in the learner's preferred language.

<learner>
${describeLearner(learner)}
</learner>`,
      prompt: `Scenario: ${block.scenario}

Hidden requirements the learner was supposed to uncover:
${hidden}

A requirement counts as uncovered only if the client actually revealed it in the transcript because of the learner's questions.

<transcript>
${transcript}
</transcript>`,
    });

    if (!debrief) return Response.json({ error: "Could not evaluate this interview." }, { status: 502 });
    const result: DebriefResult = {
      ...debrief,
      uncovered: [...new Set(debrief.uncovered)].filter((i) => i >= 0 && i < block.hiddenRequirements.length),
      total: block.hiddenRequirements.length,
      requirements: block.hiddenRequirements,
    };
    return Response.json(result);
  }

  const system = `You are playing the configured character in a learning scenario. Follow the subject and context provided.

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
- The student's preferred language is: ${preferredLanguageName(learner)}. Reply in that language.`;

  return streamText({ system, contents: history, maxTokens: 1000 });
  } catch (error) { return apiError(error); }
}
