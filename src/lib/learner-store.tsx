"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase/client";
import { isDatabaseCourseId } from "@/lib/learning/ids";
import type { BlockResult, LearnerProfile } from "@/lib/types";

/**
 * Learner state lives in localStorage so the demo works without an account.
 * When Supabase is configured and the user is signed in, every change is also
 * written to the database, and the database copy wins on load.
 */

export interface LessonProgress {
  completedAt?: string;
  blocks: Record<string, BlockResult>;
}

/** key: `${courseId}/${lessonId}` */
export type ProgressMap = Record<string, LessonProgress>;

interface LearnerState {
  ready: boolean;
  user: User | null;
  profile: LearnerProfile | null;
  saveProfile: (profile: LearnerProfile) => Promise<void>;
  progress: ProgressMap;
  recordBlock: (courseId: string, lessonId: string, blockId: string, result: BlockResult) => void;
  completeLesson: (courseId: string, lessonId: string) => void;
  noteServerLessonComplete: (courseId: string, lessonId: string) => void;
  logEvent: (courseId: string, lessonId: string | null, eventType: string, payload?: object) => void;
  signOut: () => Promise<void>;
}

const PROFILE_KEY = "learner-profile";
const PROGRESS_KEY = "learner-progress";

const LearnerContext = createContext<LearnerState | null>(null);

function readLocal<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable (private mode); the in-memory state still works.
  }
}

export function LearnerProvider({ children }: { children: React.ReactNode }) {
  const activeUserId = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<LearnerProfile | null>(null);
  const [progress, setProgress] = useState<ProgressMap>({});

  useEffect(() => {
    setProfile(readLocal<LearnerProfile>(PROFILE_KEY));
    setProgress(readLocal<ProgressMap>(PROGRESS_KEY) ?? {});

    const supabase = getSupabase();
    if (!supabase) {
      setReady(true);
      return;
    }

    let authEpoch = 0;
    const initialEpoch = authEpoch;
    supabase.auth.getUser().then(async ({ data }) => {
      if (authEpoch !== initialEpoch) return;
      activeUserId.current = data.user?.id ?? null;
      setUser(data.user);
      if (data.user) { setProfile(null); setProgress({}); }
      if (data.user) await loadRemote(data.user.id);
      setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      authEpoch++;
      const changed = activeUserId.current !== (session?.user.id ?? null);
      activeUserId.current = session?.user.id ?? null;
      setUser(session?.user ?? null);
      setReady(true);
      if (!changed) return;
      if (session?.user) {
        setProfile(null); setProgress({});
        setTimeout(() => { void loadRemote(session.user.id); }, 0);
      } else { setProfile(readLocal<LearnerProfile>(PROFILE_KEY)); setProgress(readLocal<ProgressMap>(PROGRESS_KEY) ?? {}); }
    });
    return () => { authEpoch++; activeUserId.current = null; sub.subscription.unsubscribe(); };
  }, []);

  async function loadRemote(userId: string) {
    const supabase = getSupabase();
    if (!supabase) return;

    const { data: row } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (activeUserId.current !== userId) return;
    if (row?.background) {
      const remote: LearnerProfile = {
        displayName: row.display_name ?? "",
        background: row.background,
        experience: row.experience,
        goal: row.goal,
        language: row.language ?? "en",
      };
      setProfile(remote);
      writeLocal(`${PROFILE_KEY}:${userId}`, remote);
    }

    const { data: rows } = await supabase.from("lesson_progress").select("*").eq("user_id", userId);
    if (activeUserId.current !== userId) return;
    if (rows) {
      const remote: ProgressMap = {};
      for (const r of rows) {
        remote[`${r.course_id}/${r.lesson_id}`] = {
          completedAt: r.completed_at ?? undefined,
          blocks: r.block_results ?? {},
        };
      }
      setProgress(() => {
        writeLocal(`${PROGRESS_KEY}:${userId}`, remote);
        return remote;
      });
    }
  }

  const saveProfile = useCallback(
    async (next: LearnerProfile) => {
      setProfile(next);
      writeLocal(user ? `${PROFILE_KEY}:${user.id}` : PROFILE_KEY, next);
      const supabase = getSupabase();
      if (supabase && user) {
        await supabase.from("profiles").upsert({
          id: user.id,
          display_name: next.displayName,
          background: next.background,
          experience: next.experience,
          goal: next.goal,
          language: next.language,
          updated_at: new Date().toISOString(),
        });
      }
    },
    [user],
  );

  const syncLesson = useCallback(
    (courseId: string, lessonId: string, lesson: LessonProgress) => {
      const supabase = getSupabase();
      if (!supabase || !user || isDatabaseCourseId(courseId)) return;
      void supabase.from("lesson_progress").upsert({
        user_id: user.id,
        course_id: courseId,
        lesson_id: lessonId,
        completed_at: lesson.completedAt ?? null,
        block_results: lesson.blocks,
        updated_at: new Date().toISOString(),
      });
    },
    [user],
  );

  const logEvent = useCallback(
    (courseId: string, lessonId: string | null, eventType: string, payload: object = {}) => {
      const supabase = getSupabase();
      if (!supabase || !user) return;
      void supabase.from("activity_events").insert({
        user_id: user.id,
        course_id: courseId,
        lesson_id: lessonId,
        event_type: eventType,
        payload,
      });
    },
    [user],
  );

  const updateLesson = useCallback(
    (courseId: string, lessonId: string, update: (prev: LessonProgress) => LessonProgress) => {
      setProgress((prev) => {
        const key = `${courseId}/${lessonId}`;
        const lesson = update(prev[key] ?? { blocks: {} });
        const next = { ...prev, [key]: lesson };
        writeLocal(user ? `${PROGRESS_KEY}:${user.id}` : PROGRESS_KEY, next);
        syncLesson(courseId, lessonId, lesson);
        return next;
      });
    },
    [syncLesson, user],
  );

  const recordBlock = useCallback(
    (courseId: string, lessonId: string, blockId: string, result: BlockResult) => {
      updateLesson(courseId, lessonId, (prev) => ({
        ...prev,
        blocks: { ...prev.blocks, [blockId]: result },
      }));
      logEvent(courseId, lessonId, "block_completed", { blockId, ...result });
    },
    [updateLesson, logEvent],
  );

  const completeLesson = useCallback(
    (courseId: string, lessonId: string) => {
      updateLesson(courseId, lessonId, (prev) => ({
        ...prev,
        completedAt: prev.completedAt ?? new Date().toISOString(),
      }));
      logEvent(courseId, lessonId, "lesson_completed");
    },
    [updateLesson, logEvent],
  );

  const noteServerLessonComplete = useCallback(
    (courseId: string, lessonId: string) => {
      setProgress((prev) => {
        const key = `${courseId}/${lessonId}`;
        const current = prev[key] ?? { blocks: {} };
        const next = {
          ...prev,
          [key]: {
            ...current,
            completedAt: current.completedAt ?? new Date().toISOString(),
          },
        };
        writeLocal(user ? `${PROGRESS_KEY}:${user.id}` : PROGRESS_KEY, next);
        return next;
      });
    },
    [user],
  );

  const signOut = useCallback(async () => {
    activeUserId.current = null;
    await getSupabase()?.auth.signOut();
    setUser(null); setProfile(null); setProgress({});
  }, []);

  const value = useMemo<LearnerState>(
    () => ({ ready, user, profile, saveProfile, progress, recordBlock, completeLesson, noteServerLessonComplete, logEvent, signOut }),
    [ready, user, profile, saveProfile, progress, recordBlock, completeLesson, noteServerLessonComplete, logEvent, signOut],
  );

  return <LearnerContext.Provider value={value}>{children}</LearnerContext.Provider>;
}

export function useLearner() {
  const ctx = useContext(LearnerContext);
  if (!ctx) throw new Error("useLearner must be used inside LearnerProvider");
  return ctx;
}
