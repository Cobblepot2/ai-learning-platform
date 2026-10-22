import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { enforceQuota } from "../src/lib/ai/quota";
import { HttpError } from "../src/lib/supabase/server";

function client(error: { code?: string; message: string } | null, data: boolean | null = null) {
  const calls: Array<Record<string, unknown>> = [];
  const db = {
    rpc: async (_name: string, args: Record<string, unknown>) => {
      calls.push(args);
      return { data, error };
    },
  } as unknown as SupabaseClient;
  return { db, calls };
}

test("quota RPC uses p_bucket and falls back only when the function is missing", async () => {
  const missing = client({
    code: "PGRST202",
    message: "Could not find the function public.consume_ai_quota in the schema cache",
  });
  await enforceQuota(missing.db, "user-pgrst202", "tutor");
  assert.deepEqual(missing.calls[0], {
    p_bucket: "tutor",
    max_hits: 60,
    window_seconds: 3600,
  });

  const undefinedFunction = client({
    code: "42883",
    message: "function public.consume_ai_quota(text, integer, integer) does not exist",
  });
  await enforceQuota(undefinedFunction.db, "user-42883", "feedback");

  const mentionedInText = client({
    message: "42883 function public.consume_ai_quota does not exist",
  });
  await enforceQuota(mentionedInText.db, "user-text-42883", "generation");

  const ambiguous = client({
    code: "42702",
    message: 'column reference "bucket" is ambiguous',
  });
  await assert.rejects(
    enforceQuota(ambiguous.db, "user-ambiguous", "roleplay"),
    (error: unknown) => error instanceof HttpError && error.status === 503,
  );

  const broad = client({
    code: "XX000",
    message: "function consume_ai_quota failed while checking the schema cache",
  });
  await assert.rejects(
    enforceQuota(broad.db, "user-broad", "prompt-lab"),
    (error: unknown) => error instanceof HttpError && error.status === 503,
  );

  const allowed = client(null, true);
  await enforceQuota(allowed.db, "user-allowed", "tutor");

  const limited = client(null, false);
  await assert.rejects(
    enforceQuota(limited.db, "user-limited", "tutor"),
    (error: unknown) => error instanceof HttpError && error.status === 429,
  );
});
