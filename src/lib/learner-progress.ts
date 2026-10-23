import type { SupabaseClient } from "@supabase/supabase-js";
import { isDatabaseCourseId } from "./learning/ids";
import type { BlockResult } from "./types";

/** A later submit cannot undo completion or replace a better score. */
export function mergeBlockResult(
  previous: BlockResult | undefined,
  incoming: BlockResult,
): BlockResult {
  return mergeLessonProgress(
    previous ? { blocks: { block: previous } } : undefined,
    { blocks: { block: incoming } },
  ).blocks.block;
}

export interface LessonProgress {
  completedAt?: string;
  blocks: Record<string, BlockResult>;
}

export type ProgressMap = Record<string, LessonProgress>;

export function progressKey(userId: string | null) {
  return userId ? `learner-progress:${userId}` : "learner-progress";
}

/** Legacy activities retain completion and the best score across local/remote copies. */
export function mergeLessonProgress(
  previous: LessonProgress | undefined,
  incoming: LessonProgress,
): LessonProgress {
  const blocks = { ...previous?.blocks };
  for (const [id, result] of Object.entries(incoming.blocks)) {
    const old = blocks[id];
    const scores = [old?.score, result.score].filter(
      (score): score is number => typeof score === "number",
    );
    blocks[id] = {
      done: Boolean(old?.done || result.done),
      ...(scores.length ? { score: Math.max(...scores) } : {}),
    };
  }
  return { completedAt: previous?.completedAt ?? incoming.completedAt, blocks };
}

/** Database-course completion remains authoritative on the server. */
export function mergeRemoteProgress(remote: ProgressMap, cached: ProgressMap): ProgressMap {
  const merged = { ...remote };
  for (const [key, lesson] of Object.entries(cached)) {
    if (isDatabaseCourseId(key.split("/")[0])) continue;
    merged[key] = mergeLessonProgress(remote[key], lesson);
  }
  return merged;
}

export function sameLessonProgress(left: LessonProgress | undefined, right: LessonProgress) {
  if (!left || left.completedAt !== right.completedAt) return false;
  const ids = Object.keys(right.blocks);
  return Object.keys(left.blocks).length === ids.length && ids.every((id) =>
    left.blocks[id]?.done === right.blocks[id].done &&
    left.blocks[id]?.score === right.blocks[id].score,
  );
}

export function createLegacyProgressSync(
  db: SupabaseClient,
  userId: string,
  isCurrentSession: () => boolean,
) {
  const pending = new Map<string, Promise<void>>();
  const latest = new Map<string, LessonProgress>();

  function saveLesson(courseId: string, lessonId: string, lesson: LessonProgress): Promise<void> {
    if (isDatabaseCourseId(courseId) || !isCurrentSession()) return Promise.resolve();
    const key = `${courseId}/${lessonId}`;
    const snapshot = mergeLessonProgress(latest.get(key), lesson);
    latest.set(key, snapshot);
    // Whole-lesson snapshots must arrive in order, including a completion that
    // is still being saved when another activity reports its result.
    const request = (pending.get(key) ?? Promise.resolve()).catch(() => {}).then(async () => {
      if (!isCurrentSession()) return;
      const { error } = await db.from("lesson_progress").upsert({
        user_id: userId,
        course_id: courseId,
        lesson_id: lessonId,
        completed_at: snapshot.completedAt ?? null,
        block_results: snapshot.blocks,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,course_id,lesson_id" });
      if (error) throw new Error("Could not save your progress. Please try again.");
    });
    pending.set(key, request);
    const cleanup = () => { if (pending.get(key) === request) pending.delete(key); };
    void request.then(cleanup, cleanup);
    return request;
  }

  async function logEvent(courseId: string, lessonId: string | null, eventType: string, payload: object) {
    if (!isCurrentSession()) return;
    const { error } = await db.from("activity_events").insert({
      user_id: userId,
      course_id: courseId,
      lesson_id: lessonId,
      event_type: eventType,
      payload,
    });
    if (error) throw new Error("Could not record learning activity.");
  }

  return { saveLesson, logEvent };
}

export type LegacyProgressSync = ReturnType<typeof createLegacyProgressSync>;
