import { notFound } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CourseRecord } from "@/lib/learning/model";
import { ownedCourse } from "@/lib/learning/repository";
import { HttpError, requireAccount } from "@/lib/supabase/server";
import { activityDefinitions } from "@/lib/learning/registry";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type CourseStats = {
  students: number;
  invitations: number;
  submissions: number;
  participants: number;
  completions: number;
};

export type RecentSubmission = {
  id: string;
  userId: string;
  studentName: string;
  lessonTitle: string;
  activityLabel: string;
  createdAt: string;
  score: number | null;
  revision: number;
};

/**
 * Resolve a course the signed-in teacher owns. Route pages use this so a
 * missing or foreign course becomes a normal 404 instead of a database error.
 */
export async function requireTeachingCourse(courseId: string) {
  const account = await requireAccount(true);
  if (!UUID.test(courseId)) notFound();
  try {
    const course = await ownedCourse(courseId, account.db, account.user.id);
    return { ...account, course };
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) notFound();
    throw error;
  }
}

export async function loadCourseStats(
  db: SupabaseClient,
  courseId: string,
): Promise<CourseStats> {
  const [enrolments, invitations, submissions, completions] = await Promise.all([
    db
      .from("course_enrolments")
      .select("student_id")
      .eq("course_id", courseId),
    db
      .from("course_invitations")
      .select("email")
      .eq("course_id", courseId),
    db
      .from("learning_attempts")
      .select("user_id")
      .eq("course_id", courseId)
      .limit(5000),
    db
      .from("lesson_progress")
      .select("user_id")
      .eq("course_id", courseId)
      .not("completed_at", "is", null),
  ]);
  for (const result of [enrolments, invitations, submissions, completions]) {
    if (result.error) throw result.error;
  }

  const participants = new Set(
    (submissions.data ?? []).map((row) => row.user_id as string),
  );
  return {
    students: enrolments.data?.length ?? 0,
    invitations: invitations.data?.length ?? 0,
    submissions: submissions.data?.length ?? 0,
    participants: participants.size,
    completions: completions.data?.length ?? 0,
  };
}

type AttemptRow = {
  id: string;
  user_id: string;
  lesson_id: string;
  activity_id: string;
  score: number | null;
  created_at: string;
  course_revision: number;
};

export async function loadRecentSubmissions(
  db: SupabaseClient,
  course: CourseRecord,
  limit = 6,
): Promise<RecentSubmission[]> {
  const { data, error } = await db
    .from("learning_attempts")
    .select(
      "id, user_id, lesson_id, activity_id, score, created_at, course_revision",
    )
    .eq("course_id", course.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  const attempts = (data ?? []) as AttemptRow[];
  if (!attempts.length) return [];

  const studentIds = [...new Set(attempts.map((attempt) => attempt.user_id))];
  const { data: profiles, error: profileError } = await db
    .from("profiles")
    .select("id, display_name")
    .in("id", studentIds);
  if (profileError) throw profileError;

  const names = new Map(
    (profiles ?? []).map((profile) => [
      profile.id as string,
      (profile.display_name as string | null) ?? "Student",
    ]),
  );
  const lessons = new Map(
    course.document.lessons.map((lesson) => [lesson.id, lesson]),
  );

  return attempts.map((attempt) => {
    const lesson = lessons.get(attempt.lesson_id);
    const block = lesson?.blocks.find(
      (candidate) => candidate.id === attempt.activity_id,
    );
    return {
      id: attempt.id,
      userId: attempt.user_id,
      studentName:
        names.get(attempt.user_id) ?? `Student ${attempt.user_id.slice(0, 8)}`,
      lessonTitle: lesson?.title ?? "Removed lesson",
      activityLabel: block
        ? activityDefinitions[block.activityType].label
        : "Removed activity",
      createdAt: attempt.created_at,
      score: attempt.score,
      revision: attempt.course_revision,
    };
  });
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function studentLabel(
  profile: { display_name?: string | null } | null | undefined,
  id: string,
) {
  return profile?.display_name?.trim() || `Student ${id.slice(0, 8)}`;
}

export type StudentProfile = {
  id: string;
  display_name: string | null;
  background: string | null;
  experience: string | null;
  goal: string | null;
  language: string | null;
  learning_style: string | null;
};

export type StudentAttempt = {
  id: string;
  lesson_id: string;
  activity_id: string;
  course_revision: number;
  response: string;
  feedback: {
    summary?: string;
    nextStep?: string;
    characterReply?: string;
    criteria?: {
      criterion: string;
      assessment: string;
      evidence: string;
      suggestion: string;
    }[];
  } | null;
  score: number | null;
  created_at: string;
  activity_snapshot: unknown;
};

export type StudentProgress = {
  lesson_id: string;
  completed_at: string | null;
  updated_at: string;
};

export async function loadCourseStudent(
  db: SupabaseClient,
  courseId: string,
  studentId: string,
) {
  if (!UUID.test(studentId)) notFound();
  const { data: enrolment, error: enrolmentError } = await db
    .from("course_enrolments")
    .select("student_id, created_at")
    .eq("course_id", courseId)
    .eq("student_id", studentId)
    .maybeSingle();
  if (enrolmentError) throw enrolmentError;
  if (!enrolment) notFound();

  const [profileResult, progressResult, attemptResult] = await Promise.all([
    db
      .from("profiles")
      .select("id, display_name, background, experience, goal, language, learning_style")
      .eq("id", studentId)
      .maybeSingle(),
    db
      .from("lesson_progress")
      .select("lesson_id, completed_at, updated_at")
      .eq("course_id", courseId)
      .eq("user_id", studentId),
    db
      .from("learning_attempts")
      .select(
        "id, lesson_id, activity_id, course_revision, response, feedback, score, created_at, activity_snapshot",
      )
      .eq("course_id", courseId)
      .eq("user_id", studentId)
      .order("created_at", { ascending: false }),
  ]);
  for (const result of [profileResult, progressResult, attemptResult]) {
    if (result.error) throw result.error;
  }

  return {
    enrolledAt: enrolment.created_at as string,
    profile: (profileResult.data ?? null) as StudentProfile | null,
    progress: (progressResult.data ?? []) as StudentProgress[],
    attempts: (attemptResult.data ?? []) as StudentAttempt[],
  };
}
