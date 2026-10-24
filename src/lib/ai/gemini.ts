import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

export const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

let client: GoogleGenAI | null = null;

export function getClient() {
  if (!client) client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

/** One-shot request that must return JSON matching the schema; returns null if it doesn't. */
export async function generateJson<T extends z.ZodType>(params: {
  system: string;
  prompt: string;
  schema: T;
  maxTokens?: number;
}): Promise<z.infer<T> | null> {
  // Gemini supports a subset of JSON Schema; the meta-schema URL isn't part of it.
  const jsonSchema: Record<string, unknown> = { ...z.toJSONSchema(params.schema) };
  delete jsonSchema.$schema;
  const response = await getClient().models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts: [{ text: params.prompt }] }],
    config: {
      systemInstruction: params.system,
      maxOutputTokens: params.maxTokens ?? 4096,
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

export function missingKey() {
  return process.env.GEMINI_API_KEY
    ? null
    : Response.json({ error: "GEMINI_API_KEY is not set on the server." }, { status: 500 });
}
