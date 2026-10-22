import type { SupabaseClient } from "@supabase/supabase-js";
import { HttpError } from "@/lib/supabase/server";

/**
 * Hourly AI quotas.
 *
 * The in-memory counter is per server process only. It still applies when the
 * database function is missing, so a single instance cannot be driven without
 * a limit. After `20261022180000_review_fixes.sql`, `consume_ai_quota` is the
 * shared quota. A request must pass both.
 *
 * Course generation stays available to any signed-in user (students build
 * private courses) and is limited here rather than closed to teachers.
 */
export const AI_QUOTA = {
  generation: 12,
  feedback: 40,
  tutor: 60,
  roleplay: 40,
  "prompt-lab": 30,
} as const;

export type AiBucket = keyof typeof AI_QUOTA;

const WINDOW_MS = 60 * 60 * 1000;
const memory = new Map<string, { start: number; hits: number }>();

function consumeMemory(userId: string, bucket: AiBucket): boolean {
  const key = `${userId}:${bucket}`;
  const now = Date.now();
  const row = memory.get(key);
  if (!row || now - row.start >= WINDOW_MS) {
    memory.set(key, { start: now, hits: 1 });
    return true;
  }
  row.hits += 1;
  return row.hits <= AI_QUOTA[bucket];
}

export async function enforceQuota(
  db: SupabaseClient,
  userId: string,
  bucket: AiBucket,
) {
  if (!consumeMemory(userId, bucket)) {
    throw new HttpError(
      429,
      `Hourly limit reached for ${bucket}. Wait and try again.`,
    );
  }
  const { data, error } = await db.rpc("consume_ai_quota", {
    bucket,
    max_hits: AI_QUOTA[bucket],
    window_seconds: 3600,
  });
  if (error) {
    if (/consume_ai_quota|schema cache|function|PGRST202/i.test(error.message)) {
      console.warn(
        "AI quota RPC unavailable; using the in-memory per-instance limit only.",
      );
      return;
    }
    throw new HttpError(503, "Could not check the AI usage quota.");
  }
  if (data !== true) {
    throw new HttpError(
      429,
      `Hourly limit reached for ${bucket}. Wait and try again.`,
    );
  }
}
