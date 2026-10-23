"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase/client";
import { isDatabaseCourseId } from "@/lib/learning/ids";
import {
  createLegacyProgressSync,
  mergeBlockResult,
  mergeRemoteProgress,
  progressKey,
  sameLessonProgress,
  type LegacyProgressSync,
  type LessonProgress,
  type ProgressMap,
} from "@/lib/learner-progress";
import {
  normalizeCoursePreference,
  normalizeProfile,
  profileFromRow,
  profileToRow,
} from "@/lib/learner/preferences";
import type { BlockResult, CoursePreference, LearnerProfile } from "@/lib/types";

export type { LessonProgress, ProgressMap } from "@/lib/learner-progress";

interface LearnerState {
  ready: boolean;
  user: User | null;
  profile: LearnerProfile | null;
  saveProfile: (profile: LearnerProfile) => Promise<void>;
  coursePreferences: Record<string, CoursePreference>;
  saveCoursePreference: (
    courseId: string,
    preference: CoursePreference,
  ) => Promise<void>;
  progress: ProgressMap;
  recordBlock: (courseId: string, lessonId: string, blockId: string, result: BlockResult) => void;
  completeLesson: (courseId: string, lessonId: string) => Promise<void>;
  noteServerLessonComplete: (courseId: string, lessonId: string) => void;
  logEvent: (courseId: string, lessonId: string | null, eventType: string, payload?: object) => void;
  signOut: () => Promise<void>;
}

interface LearnerSession {
  userId: string | null;
  sync: LegacyProgressSync | null;
}

const PROFILE_KEY = "learner-profile";
const COURSE_PREFS_KEY = "learner-course-preferences";
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
    // The in-memory state still works when browser storage is unavailable.
  }
}

function profileKey(userId: string | null) {
  return userId ? `${PROFILE_KEY}:${userId}` : PROFILE_KEY;
}

function coursePrefsKey(userId: string | null) {
  return userId ? `${COURSE_PREFS_KEY}:${userId}` : COURSE_PREFS_KEY;
}

function readProfile(key: string): LearnerProfile | null {
  const raw = readLocal<unknown>(key);
  return raw ? normalizeProfile(raw) : null;
}

function readCoursePreferences(key: string): Record<string, CoursePreference> {
  const raw = readLocal<unknown>(key);
  if (!raw || typeof raw !== "object") return {};
  const preferences: Record<string, CoursePreference> = {};
  for (const [courseId, value] of Object.entries(raw)) {
    const preference = normalizeCoursePreference(value);
    if (preference) preferences[courseId] = preference;
  }
  return preferences;
}

export function LearnerProvider({ children }: { children: React.ReactNode }) {
  const activeSession = useRef<LearnerSession | null>(null);
  const progressRef = useRef<ProgressMap>({});
  const [session, setSession] = useState<LearnerSession | null>(null);
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<LearnerProfile | null>(null);
  const [coursePreferences, setCoursePreferences] = useState<Record<string, CoursePreference>>({});
  const [progress, setProgress] = useState<ProgressMap>({});
  const [syncError, setSyncError] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [retrying, setRetrying] = useState(false);

  // Keep side effects out of React state updaters, which may be replayed.
  const replaceProgress = useCallback((next: ProgressMap) => {
    progressRef.current = next;
    setProgress(next);
  }, []);

  const storeProgress = useCallback((next: ProgressMap) => {
    replaceProgress(next);
    writeLocal(progressKey(activeSession.current?.userId ?? null), next);
  }, [replaceProgress]);

  useEffect(() => {
    const supabase = getSupabase();
    let disposed = false;
    let initialized = false;

    function activate(nextUser: User | null) {
      if (disposed) return;
      const userId = nextUser?.id ?? null;
      setUser(nextUser);
      if (initialized && activeSession.current?.userId === userId) return;
      initialized = true;
      const session: LearnerSession = { userId, sync: null };
      const isCurrent = () => !disposed && activeSession.current === session;
      activeSession.current = session;
      setSession(session);
      setSyncError("");
      setLoadError(false);
      setRetrying(false);
      setProfile(readProfile(profileKey(userId)));
      setCoursePreferences(readCoursePreferences(coursePrefsKey(userId)));
      replaceProgress(mergeRemoteProgress({}, readLocal<ProgressMap>(progressKey(userId)) ?? {}));
      setReady(!userId);
      if (!supabase || !userId) return;

      // Do not run Supabase requests inside its auth-state callback.
      setTimeout(() => { void hydrate(); }, 0);
      async function hydrate() {
        if (!supabase || !isCurrent()) return;
        try {
          const { data: row } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
          if (!isCurrent()) return;
          if (row) {
            const remote = profileFromRow(row);
            setProfile(remote);
            writeLocal(profileKey(userId), remote);
          }

          const { data: preferenceRows, error: preferenceError } = await supabase
            .from("course_learner_preferences")
            .select("course_id,experience,goal")
            .eq("user_id", userId);
          if (!isCurrent()) return;
          if (!preferenceError) {
            const remotePreferences: Record<string, CoursePreference> = {};
            for (const preferenceRow of preferenceRows ?? []) {
              const preference = normalizeCoursePreference(preferenceRow);
              if (preference) remotePreferences[preferenceRow.course_id as string] = preference;
            }
            setCoursePreferences(remotePreferences);
            writeLocal(coursePrefsKey(userId), remotePreferences);
          }

          const { data: rows, error } = await supabase.from("lesson_progress").select("*").eq("user_id", userId);
          if (!isCurrent()) return;
          if (error) throw error;
          const remote: ProgressMap = {};
          for (const row of rows ?? []) {
            remote[`${row.course_id}/${row.lesson_id}`] = {
              completedAt: row.completed_at ?? undefined,
              blocks: row.block_results ?? {},
            };
          }
          const merged = mergeRemoteProgress(remote, progressRef.current);
          storeProgress(merged);
          // Until the read succeeds, retain local work without overwriting
          // remote results that this session has not been able to load.
          session.sync = createLegacyProgressSync(supabase, userId!, isCurrent);
          // Recover legacy results cached before the old lazy writes were fixed,
          // and retry results retained during a previous network failure.
          for (const [key, lesson] of Object.entries(merged)) {
            const [courseId, lessonId] = key.split("/");
            if (isDatabaseCourseId(courseId) || sameLessonProgress(remote[key], lesson)) continue;
            void session.sync!.saveLesson(courseId, lessonId, lesson).catch(() => {
              if (isCurrent()) setSyncError("Your progress is saved on this device, but could not be synced.");
            });
          }
        } catch {
          if (isCurrent()) setLoadError(true);
        } finally {
          if (isCurrent()) setReady(true);
        }
      }
    }

    if (!supabase) {
      activate(null);
      return () => { disposed = true; activeSession.current = null; };
    }
    void supabase.auth.getUser().then(({ data }) => {
      if (!initialized) activate(data.user);
    }).catch(() => { if (!initialized) activate(null); });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      activate(session?.user ?? null);
    });
    return () => {
      disposed = true;
      activeSession.current = null;
      sub.subscription.unsubscribe();
    };
  }, [replaceProgress, storeProgress]);

  const saveProfile = useCallback(async (next: LearnerProfile) => {
    if (!session || activeSession.current !== session) return;
    const normalized = normalizeProfile(next);
    const supabase = getSupabase();
    if (supabase && user) {
      // Update rather than upsert: PostgREST's upsert would also assign the
      // primary key, but ordinary learners have no UPDATE grant on `id`.
      const row = {
        ...profileToRow(normalized),
        updated_at: new Date().toISOString(),
      };
      const { data: updated, error } = await supabase
        .from("profiles")
        .update(row)
        .eq("id", user.id)
        .select("id");
      if (error) {
        throw new Error(
          "Could not save your preferences. Check your connection and try again.",
        );
      }
      if (!updated?.length) {
        const { error: insertError } = await supabase
          .from("profiles")
          .insert({ id: user.id, ...row });
        if (insertError) {
          throw new Error(
            "Could not save your preferences. Check your connection and try again.",
          );
        }
      }
    }
    if (activeSession.current !== session) return;
    setProfile(normalized);
    writeLocal(profileKey(user?.id ?? null), normalized);
  }, [user, session]);

  const saveCoursePreference = useCallback(async (courseId: string, preference: CoursePreference) => {
    if (!session || activeSession.current !== session) return;
    const normalized = normalizeCoursePreference(preference);
    if (!normalized) {
      throw new Error("Choose an experience level and a goal for this course.");
    }
    const supabase = getSupabase();
    if (supabase && user) {
      const { error } = await supabase
        .from("course_learner_preferences")
        .upsert(
          {
            user_id: user.id,
            course_id: courseId,
            ...normalized,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,course_id" },
        );
      if (error) {
        throw new Error(
          "Could not save this course's preferences. Check your connection and try again.",
        );
      }
    }
    if (activeSession.current !== session) return;
    setCoursePreferences((previous) => {
      const next = { ...previous, [courseId]: normalized };
      writeLocal(coursePrefsKey(user?.id ?? null), next);
      return next;
    });
  }, [user, session]);

  const logEvent = useCallback((courseId: string, lessonId: string | null, eventType: string, payload: object = {}) => {
    if (!session?.sync || activeSession.current !== session) return;
    void session.sync.logEvent(courseId, lessonId, eventType, payload).catch(() => {
      // Auxiliary analytics must not turn a saved lesson into a failed completion.
      console.warn("Could not record learning activity.");
    });
  }, [session]);

  const updateLesson = useCallback((courseId: string, lessonId: string, update: (prev: LessonProgress) => LessonProgress) => {
    if (!session || activeSession.current !== session) return;
    const key = `${courseId}/${lessonId}`;
    const lesson = update(progressRef.current[key] ?? { blocks: {} });
    storeProgress({ ...progressRef.current, [key]: lesson });
    return lesson;
  }, [storeProgress, session]);

  const recordBlock = useCallback((courseId: string, lessonId: string, blockId: string, result: BlockResult) => {
    const lesson = updateLesson(courseId, lessonId, (prev) => ({
      ...prev,
      blocks: {
        ...prev.blocks,
        [blockId]: mergeBlockResult(prev.blocks[blockId], result),
      },
    }));
    if (!lesson) return;
    if (session?.sync) {
      void session.sync.saveLesson(courseId, lessonId, lesson).catch(() => {
        if (activeSession.current === session) setSyncError("Your progress is saved on this device, but could not be synced.");
      });
    }
    logEvent(courseId, lessonId, "block_completed", { blockId, ...result });
  }, [updateLesson, logEvent, session]);

  const completeLesson = useCallback(async (courseId: string, lessonId: string) => {
    if (!session || activeSession.current !== session || isDatabaseCourseId(courseId)) return;
    if (session.userId && !session.sync) {
      throw new Error("Could not load saved progress. Reload the page before completing this lesson.");
    }
    const key = `${courseId}/${lessonId}`;
    const lesson = progressRef.current[key] ?? { blocks: {} };
    const completedAt = lesson.completedAt ?? new Date().toISOString();
    // Show completion only after the signed-in learner's write has succeeded.
    await session?.sync?.saveLesson(courseId, lessonId, { ...lesson, completedAt });
    if (activeSession.current !== session) return;
    updateLesson(courseId, lessonId, (current) => ({ ...current, completedAt }));
    setSyncError("");
    logEvent(courseId, lessonId, "lesson_completed");
  }, [updateLesson, logEvent, session]);

  const noteServerLessonComplete = useCallback((courseId: string, lessonId: string) => {
    updateLesson(courseId, lessonId, (current) => ({
      ...current,
      completedAt: current.completedAt ?? new Date().toISOString(),
    }));
  }, [updateLesson]);

  const retryProgress = useCallback(async () => {
    if (!session?.sync || activeSession.current !== session) return;
    setRetrying(true);
    try {
      await Promise.all(Object.entries(progressRef.current).map(([key, lesson]) => {
        const [courseId, lessonId] = key.split("/");
        return session.sync!.saveLesson(courseId, lessonId, lesson);
      }));
      if (activeSession.current === session) setSyncError("");
    } catch {
      if (activeSession.current === session) setSyncError("Your progress is saved on this device, but could not be synced.");
    } finally {
      if (activeSession.current === session) setRetrying(false);
    }
  }, [session]);

  const signOut = useCallback(async () => {
    await getSupabase()?.auth.signOut();
  }, []);

  const value = useMemo<LearnerState>(
    () => ({ ready, user, profile, saveProfile, coursePreferences, saveCoursePreference, progress, recordBlock, completeLesson, noteServerLessonComplete, logEvent, signOut }),
    [ready, user, profile, saveProfile, coursePreferences, saveCoursePreference, progress, recordBlock, completeLesson, noteServerLessonComplete, logEvent, signOut],
  );

  return (
    <LearnerContext.Provider value={value}>
      {loadError && (
        <div role="alert" className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Could not load saved progress. Your progress on this device is still available.{" "}
          <button type="button" onClick={() => window.location.reload()} className="font-medium underline">
            Reload progress
          </button>
        </div>
      )}
      {syncError && (
        <div role="alert" className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {syncError}{" "}
          <button type="button" onClick={retryProgress} disabled={retrying} className="font-medium underline">
            {retrying ? "Saving…" : "Retry saving"}
          </button>
        </div>
      )}
      {children}
    </LearnerContext.Provider>
  );
}

export function useLearner() {
  const ctx = useContext(LearnerContext);
  if (!ctx) throw new Error("useLearner must be used inside LearnerProvider");
  return ctx;
}
