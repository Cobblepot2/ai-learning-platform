import Anthropic from "@anthropic-ai/sdk";
import type { AnthropicBeta } from "@anthropic-ai/sdk/resources/beta/beta";
import type { BetaMessageParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { BACKGROUND_LABELS, EXPERIENCE_LABELS, GOAL_LABELS, type LearnerProfile } from "@/lib/types";

export const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5-5";

// Server-side fallback re-runs a declined request on another model instead of failing it.
export const FALLBACK: { betas: AnthropicBeta[]; fallbacks: "default" } = {
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default",
};

let client: Anthropic | null = null;
export function getClient() {
  if (!client) client = new Anthropic();
  return client;
}

export const MAX_TURNS = 30;
export const MAX_CHARS = 4000;

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/** Validates chat history from the browser and converts it to API messages. */
export function toMessages(turns: unknown, { requireUserLast = true } = {}): BetaMessageParam[] | null {
  if (!Array.isArray(turns) || turns.length === 0 || turns.length > MAX_TURNS) return null;
  const out: BetaMessageParam[] = [];
  for (const t of turns) {
    if (
      !t ||
      (t.role !== "user" && t.role !== "assistant") ||
      typeof t.content !== "string" ||
      t.content.length === 0 ||
      t.content.length > MAX_CHARS
    ) {
      return null;
    }
    out.push({ role: t.role, content: t.content });
  }
  if (requireUserLast && out[out.length - 1].role !== "user") return null;
  return out;
}

export function describeLearner(profile: LearnerProfile | null | undefined): string {
  if (!profile) return "No learner profile yet. Assume a curious beginner with no programming background.";
  const lang = profile.language === "zh" ? "Traditional Chinese (Hong Kong usage)" : "English";
  return [
    `Name: ${profile.displayName || "(not given)"}`,
    `Background: ${BACKGROUND_LABELS[profile.background] ?? profile.background}`,
    `Coding experience: ${EXPERIENCE_LABELS[profile.experience] ?? profile.experience}`,
    `Goal: ${GOAL_LABELS[profile.goal] ?? profile.goal}`,
    `Preferred language: ${lang}`,
  ].join("\n");
}

/** Streams the model's text deltas to the browser as a plain-text response. */
export function streamText(params: {
  system: string;
  messages: BetaMessageParam[];
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
}): Response {
  const stream = getClient().beta.messages.stream({
    model: MODEL,
    max_tokens: params.maxTokens ?? 4000,
    system: params.system,
    messages: params.messages,
    output_config: { effort: params.effort ?? "low" },
    ...FALLBACK,
  });

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal") {
          controller.enqueue(encoder.encode("\n\n_(I can't help with that one. Try asking another way.)_"));
        }
      } catch (err) {
        console.error("Claude stream failed", err);
        controller.enqueue(encoder.encode("\n\n_(The AI service is unavailable right now. Please try again.)_"));
      } finally {
        controller.close();
      }
    },
    cancel() {
      stream.abort();
    },
  });

  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
}

export function badRequest(message: string) {
  return Response.json({ error: message }, { status: 400 });
}

export function missingKey() {
  return process.env.ANTHROPIC_API_KEY
    ? null
    : Response.json({ error: "ANTHROPIC_API_KEY is not set on the server." }, { status: 500 });
}
