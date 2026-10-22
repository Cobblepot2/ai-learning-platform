import { GoogleGenAI, type Content } from "@google/genai";
import { z } from "zod";
import { BACKGROUND_LABELS, EXPERIENCE_LABELS, GOAL_LABELS, type LearnerProfile } from "@/lib/types";

export const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

let client: GoogleGenAI | null = null;
export function getClient() {
  if (!client) client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

export const MAX_TURNS = 30;
export const MAX_CHARS = 4000;

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/** Validates chat history from the browser and converts it to Gemini contents. */
export function toContents(turns: unknown, { requireUserLast = true } = {}): Content[] | null {
  if (!Array.isArray(turns) || turns.length === 0 || turns.length > MAX_TURNS) return null;
  const out: Content[] = [];
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
    out.push({ role: t.role === "assistant" ? "model" : "user", parts: [{ text: t.content }] });
  }
  if (requireUserLast && out[out.length - 1].role !== "user") return null;
  return out;
}

export function describeLearner(profile: LearnerProfile | null | undefined): string {
  if (!profile) return "No learner profile yet. Assume a curious beginner in the current subject.";
  const lang = profile.language === "zh" ? "Traditional Chinese (Hong Kong usage)" : "English";
  return [
    `Name: ${profile.displayName || "(not given)"}`,
    `Background: ${BACKGROUND_LABELS[profile.background] ?? profile.background}`,
    `Self-reported subject experience: ${EXPERIENCE_LABELS[profile.experience] ?? profile.experience}`,
    `Goal: ${GOAL_LABELS[profile.goal] ?? profile.goal}`,
    `Preferred language: ${lang}`,
  ].join("\n");
}

/** Streams the model's text to the browser as a plain-text response. */
export function streamText(params: { system: string; contents: Content[]; maxTokens?: number }): Response {
  const encoder = new TextEncoder();
  const abort = new AbortController();

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const stream = await getClient().models.generateContentStream({
          model: MODEL,
          contents: params.contents,
          config: {
            systemInstruction: params.system,
            maxOutputTokens: params.maxTokens ?? 2048,
            abortSignal: abort.signal,
          },
        });
        let sent = false;
        for await (const chunk of stream) {
          const text = chunk.text;
          if (text) {
            controller.enqueue(encoder.encode(text));
            sent = true;
          }
        }
        if (!sent) {
          controller.enqueue(encoder.encode("_(I can't help with that one. Try asking another way.)_"));
        }
      } catch (err) {
        if (!abort.signal.aborted) {
          console.error("Gemini stream failed", err);
          controller.enqueue(encoder.encode("\n\n_(The AI service is unavailable right now. Please try again.)_"));
        }
      } finally {
        controller.close();
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
}

/** One-shot request that must return JSON matching the schema; returns null if it doesn't. */
export async function generateJson<T extends z.ZodType>(params: {
  system: string;
  prompt: string;
  schema: T;
}): Promise<z.infer<T> | null> {
  // Gemini supports a subset of JSON Schema; the meta-schema URL isn't part of it.
  const jsonSchema: Record<string, unknown> = { ...z.toJSONSchema(params.schema) };
  delete jsonSchema.$schema;
  const response = await getClient().models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts: [{ text: params.prompt }] }],
    config: {
      systemInstruction: params.system,
      maxOutputTokens: 4096,
      responseMimeType: "application/json",
      responseJsonSchema: jsonSchema,
    },
  });
  try {
    const parsed = params.schema.safeParse(JSON.parse(response.text ?? ""));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function badRequest(message: string) {
  return Response.json({ error: message }, { status: 400 });
}

export function missingKey() {
  return process.env.GEMINI_API_KEY
    ? null
    : Response.json({ error: "GEMINI_API_KEY is not set on the server." }, { status: 500 });
}
