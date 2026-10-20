"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase/client";
import type { BlockResult, LearnerProfile } from "@/lib/types";

/**
 * Learner state lives in localStorage so the demo works without an account.
 * When Supabase is configured and the user is signed in, every change is also
 * written to the database, and the database copy wins on load.
 */

interface LessonProgress {
  completedAt?: string;
  blocks: Record<string, BlockResult>;
}

type ProgressMap = Record<string, LessonProgress>; // key: `${courseId}/${lessonId}`

interface LearnerState {
  ready: boolean;
  user: User | null;
  profile: LearnerProfile | null;
  saveProfile: (profile: LearnerProfile) => Promise<void>;
  progress: ProgressMap;
  recordBlock: (courseId: string, lessonId: string, blockId: string, result: BlockResult) => void;
  completeLesson: (courseId: string, lessonId: string) => void;
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

    supabase.auth.getUser().then(async ({ data }) => {
      setUser(data.user);
      if (data.user) await loadRemote(data.user.id);
      setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function loadRemote(userId: string) {
    const supabase = getSupabase();
    if (!supabase) return;

    const { data: row } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (row?.background) {
      const remote: LearnerProfile = {
        displayName: row.display_name ?? "",
        background: row.background,
        experience: row.experience,
        goal: row.goal,
        language: row.language ?? "en",
      };
      setProfile(remote);
      writeLocal(PROFILE_KEY, remote);
    }

    const { data: rows } = await supabase.from("lesson_progress").select("*").eq("user_id", userId);
    if (rows?.length) {
      const remote: ProgressMap = {};
      for (const r of rows) {
        remote[`${r.course_id}/${r.lesson_id}`] = {
          completedAt: r.completed_at ?? undefined,
          blocks: r.block_results ?? {},
        };
      }
      setProgress((local) => {
        const merged = { ...local, ...remote };
        writeLocal(PROGRESS_KEY, merged);
        return merged;
      });
    }
  }

  const saveProfile = useCallback(
    async (next: LearnerProfile) => {
      setProfile(next);
      writeLocal(PROFILE_KEY, next);
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
      if (!supabase || !user) return;
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
        writeLocal(PROGRESS_KEY, next);
        syncLesson(courseId, lessonId, lesson);
        return next;
      });
    },
    [syncLesson],
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

  const signOut = useCallback(async () => {
    await getSupabase()?.auth.signOut();
    setUser(null);
  }, []);

  const value = useMemo<LearnerState>(
    () => ({ ready, user, profile, saveProfile, progress, recordBlock, completeLesson, logEvent, signOut }),
    [ready, user, profile, saveProfile, progress, recordBlock, completeLesson, logEvent, signOut],
  );

  return <LearnerContext.Provider value={value}>{children}</LearnerContext.Provider>;
}

export function useLearner() {
  const ctx = useContext(LearnerContext);
  if (!ctx) throw new Error("useLearner must be used inside LearnerProvider");
  return ctx;
}
