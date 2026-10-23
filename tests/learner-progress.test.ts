import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import {
  createLegacyProgressSync,
  mergeBlockResult,
  mergeLessonProgress,
  mergeRemoteProgress,
  progressKey,
  sameLessonProgress,
  type ProgressMap,
} from "../src/lib/learner-progress";

const userId = "00000000-0000-4000-8000-000000000001";
const databaseCourse = "10000000-0000-4000-8000-000000000001";
const completedAt = "2026-10-22T12:00:00.000Z";

interface CapturedRequest {
  url: URL;
  method: string;
  body: Record<string, unknown>;
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

function successfulWrite() {
  return new Response(null, { status: 201 });
}

/** Use the real lazy PostgREST builder so an un-awaited upsert makes zero requests. */
function clientWithFetch(
  respond: (request: CapturedRequest, index: number) => Response | Promise<Response> = successfulWrite,
) {
  const calls: CapturedRequest[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    const captured = {
      url: new URL(request.url),
      method: request.method,
      body: await request.json() as Record<string, unknown>,
    };
    calls.push(captured);
    return respond(captured, calls.length - 1);
  };
  const db = createClient("https://progress.example.test", "test-anon-key", {
    global: { fetch },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return { db, calls };
}

test("legacy progress and engagement writes execute real PostgREST requests", async () => {
  const { db, calls } = clientWithFetch();
  const sync = createLegacyProgressSync(db, userId, () => true);
  await sync.saveLesson("se-essentials", "testing", {
    completedAt,
    blocks: { review: { done: true }, quiz: { done: true, score: 1 } },
  });
  await sync.logEvent("se-essentials", "testing", "lesson_completed", { source: "lesson" });

  assert.equal(calls.length, 2, "Both lazy builders must actually initiate an HTTP request");
  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].url.pathname, "/rest/v1/lesson_progress");
  assert.equal(calls[0].url.searchParams.get("on_conflict"), "user_id,course_id,lesson_id");
  assert.deepEqual({ ...calls[0].body, updated_at: undefined }, {
    user_id: userId,
    course_id: "se-essentials",
    lesson_id: "testing",
    completed_at: completedAt,
    block_results: { review: { done: true }, quiz: { done: true, score: 1 } },
    updated_at: undefined,
  });
  assert.ok(!Number.isNaN(Date.parse(String(calls[0].body.updated_at))));
  assert.equal(calls[1].method, "POST");
  assert.equal(calls[1].url.pathname, "/rest/v1/activity_events");
  assert.deepEqual(calls[1].body, {
    user_id: userId,
    course_id: "se-essentials",
    lesson_id: "testing",
    event_type: "lesson_completed",
    payload: { source: "lesson" },
  });
});

test("rapid activity and completion writes cannot arrive out of order or lose earlier results", { timeout: 5000 }, async () => {
  const started = deferred<void>();
  const firstResponse = deferred<Response>();
  const { db, calls } = clientWithFetch((_request, index) => {
    if (index === 0) {
      started.resolve();
      return firstResponse.promise;
    }
    return successfulWrite();
  });
  const sync = createLegacyProgressSync(db, userId, () => true);
  const first = sync.saveLesson("se-essentials", "testing", {
    blocks: { review: { done: true, score: 0.8 } },
  });
  await started.promise;
  const second = sync.saveLesson("se-essentials", "testing", {
    blocks: { review: { done: false, score: 0.2 }, quiz: { done: true } },
  });
  const completion = sync.saveLesson("se-essentials", "testing", { completedAt, blocks: {} });
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(calls.length, 1, "Later snapshots must wait for the in-flight write");

  firstResponse.resolve(successfulWrite());
  await Promise.all([first, second, completion]);
  assert.equal(calls.length, 3);
  assert.deepEqual(calls[1].body.block_results, {
    review: { done: true, score: 0.8 }, quiz: { done: true },
  });
  assert.equal(calls[1].body.completed_at, null);
  assert.deepEqual(calls[2].body.block_results, calls[1].body.block_results);
  assert.equal(calls[2].body.completed_at, completedAt);
});

test("a slow lesson does not block saving progress in another course or lesson", { timeout: 5000 }, async () => {
  const started = deferred<void>();
  const firstResponse = deferred<Response>();
  const { db, calls } = clientWithFetch((_request, index) => {
    if (index === 0) {
      started.resolve();
      return firstResponse.promise;
    }
    return successfulWrite();
  });
  const sync = createLegacyProgressSync(db, userId, () => true);
  const blocked = sync.saveLesson("course-a", "lesson-a", { blocks: {} });
  await started.promise;
  await Promise.all([
    sync.saveLesson("course-b", "lesson-a", { completedAt, blocks: {} }),
    sync.saveLesson("course-a", "lesson-b", { completedAt, blocks: {} }),
  ]);
  assert.equal(calls.length, 3);
  firstResponse.resolve(successfulWrite());
  await blocked;
});

test("failed writes reject and later saves can retry without discarding completed activities", async () => {
  const { db, calls } = clientWithFetch((_request, index) => index === 0
    ? Response.json({ code: "42501", message: "permission denied" }, { status: 403 })
    : successfulWrite());
  const sync = createLegacyProgressSync(db, userId, () => true);
  await assert.rejects(sync.saveLesson("se-essentials", "testing", {
    blocks: { review: { done: true } },
  }));
  await sync.saveLesson("se-essentials", "testing", {
    completedAt, blocks: { quiz: { done: true } },
  });
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1].body.block_results, {
    review: { done: true }, quiz: { done: true },
  });
  assert.equal(calls[1].body.completed_at, completedAt);
});

test("engagement errors are surfaced instead of reporting a successful write", async () => {
  const { db, calls } = clientWithFetch(() => Response.json(
    { code: "42501", message: "permission denied" }, { status: 403 },
  ));
  const sync = createLegacyProgressSync(db, userId, () => true);
  await assert.rejects(sync.logEvent("se-essentials", null, "tutor_message", {}));
  assert.equal(calls.length, 1);
});

test("queued writes from a previous account stop when its session becomes inactive", { timeout: 5000 }, async () => {
  let current = true;
  const started = deferred<void>();
  const firstResponse = deferred<Response>();
  const { db, calls } = clientWithFetch(() => {
    started.resolve();
    return firstResponse.promise;
  });
  const sync = createLegacyProgressSync(db, userId, () => current);
  const inFlight = sync.saveLesson("se-essentials", "testing", { blocks: { review: { done: true } } });
  await started.promise;
  const queued = sync.saveLesson("se-essentials", "testing", { completedAt, blocks: {} });
  current = false;
  firstResponse.resolve(successfulWrite());
  await Promise.all([inFlight, queued]);
  await sync.saveLesson("se-essentials", "another-lesson", { completedAt, blocks: {} });
  await sync.logEvent("se-essentials", "testing", "lesson_completed", {});
  assert.equal(calls.length, 1, "Only the request already in flight may finish after account switching");
});

test("legacy synchronization never writes completion for server-verified database courses", async () => {
  const { db, calls } = clientWithFetch();
  const sync = createLegacyProgressSync(db, userId, () => true);
  await sync.saveLesson(databaseCourse, "testing", { completedAt, blocks: { quiz: { done: true } } });
  await sync.saveLesson(databaseCourse.toUpperCase(), "testing", { completedAt, blocks: {} });
  assert.equal(calls.length, 0);
});

test("refresh reconciliation retains unsaved legacy progress while trusting server-verified courses", () => {
  const remote: ProgressMap = {
    "se-essentials/testing": { blocks: { review: { done: true, score: 0.9 } } },
    "se-essentials/remote-only": { blocks: {} },
    [`${databaseCourse}/testing`]: { blocks: { quiz: { done: false } } },
  };
  const cached: ProgressMap = {
    "se-essentials/testing": {
      completedAt,
      blocks: { review: { done: false, score: 0.3 }, quiz: { done: true } },
    },
    "se-essentials/local-only": { completedAt, blocks: {} },
    [`${databaseCourse}/testing`]: { completedAt, blocks: { quiz: { done: true } } },
    [`${databaseCourse}/cache-only`]: { completedAt, blocks: {} },
  };
  const originalRemote = structuredClone(remote);
  const originalCached = structuredClone(cached);
  const merged = mergeRemoteProgress(remote, cached);
  assert.deepEqual(merged["se-essentials/testing"], {
    completedAt,
    blocks: { review: { done: true, score: 0.9 }, quiz: { done: true } },
  });
  assert.deepEqual(merged["se-essentials/local-only"], cached["se-essentials/local-only"]);
  assert.deepEqual(merged["se-essentials/remote-only"], remote["se-essentials/remote-only"]);
  assert.deepEqual(merged[`${databaseCourse}/testing`], remote[`${databaseCourse}/testing`]);
  assert.equal(merged[`${databaseCourse}/cache-only`], undefined);
  assert.deepEqual(remote, originalRemote);
  assert.deepEqual(cached, originalCached);
});

test("revisiting an activity cannot mark it incomplete or drop a better score", () => {
  assert.deepEqual(
    mergeBlockResult({ done: true, score: 1 }, { done: false, score: 0 }),
    { done: true, score: 1 },
  );
  assert.deepEqual(
    mergeBlockResult({ done: true, score: 0.5 }, { done: true }),
    { done: true, score: 0.5 },
  );
  assert.deepEqual(
    mergeBlockResult({ done: false, score: 0.25 }, { done: true, score: 1 }),
    { done: true, score: 1 },
  );
  assert.deepEqual(mergeBlockResult(undefined, { done: false, score: 0 }), {
    done: false,
    score: 0,
  });
});

test("progress merge preserves completion, best scores, and meaningful zero scores", () => {
  const merged = mergeLessonProgress({
    completedAt,
    blocks: { quiz: { done: true, score: 0.75 }, untouched: { done: true } },
  }, {
    blocks: { quiz: { done: false, score: 0.25 }, newQuiz: { done: false, score: 0 } },
  });
  assert.deepEqual(merged, {
    completedAt,
    blocks: {
      quiz: { done: true, score: 0.75 }, untouched: { done: true }, newQuiz: { done: false, score: 0 },
    },
  });
  assert.deepEqual(mergeLessonProgress(undefined, { blocks: {} }).blocks, {});
});

test("cache keys separate guest and accounts, and equality ignores block insertion order", () => {
  assert.equal(progressKey(null), "learner-progress");
  assert.equal(progressKey(userId), `learner-progress:${userId}`);
  assert.notEqual(progressKey(userId), progressKey("another-user"));
  const lesson = { completedAt, blocks: { review: { done: true }, quiz: { done: true, score: 0 } } };
  assert.equal(sameLessonProgress({
    completedAt, blocks: { quiz: { done: true, score: 0 }, review: { done: true } },
  }, lesson), true);
  assert.equal(sameLessonProgress(undefined, lesson), false);
  assert.equal(sameLessonProgress({ ...lesson, completedAt: undefined }, lesson), false);
  assert.equal(sameLessonProgress({ ...lesson, blocks: { review: { done: true } } }, lesson), false);
  assert.equal(sameLessonProgress({
    ...lesson, blocks: { review: { done: true }, quiz: { done: true } },
  }, lesson), false);
});
