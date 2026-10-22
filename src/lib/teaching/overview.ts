import type { SupabaseClient } from "@supabase/supabase-js";

export type TeachingCourseStatus = "draft" | "published" | "archived";
export type TeachingCourseVisibility = "private" | "enrolled" | "public";

export type TeachingCourse = {
  id: string;
  title: string;
  domain: string;
  status: TeachingCourseStatus;
  visibility: TeachingCourseVisibility;
  lessonCount: number;
  studentCount: number;
  pendingInvitations: number;
  updatedAt: string | null;
};

export type TeachingOverview = {
  courses: TeachingCourse[];
  totals: {
    courses: number;
    published: number;
    drafts: number;
    archived: number;
    students: number;
    pendingInvitations: number;
  };
};

type CourseRow = {
  id: string;
  document: unknown;
  status: string;
  visibility: string;
  updated_at: string | null;
};

function asStatus(value: string): TeachingCourseStatus {
  return value === "published" || value === "archived" ? value : "draft";
}

function asVisibility(value: string): TeachingCourseVisibility {
  return value === "enrolled" || value === "public" ? value : "private";
}

function documentSummary(document: unknown) {
  const value =
    document && typeof document === "object"
      ? (document as Record<string, unknown>)
      : {};
  const lessons = Array.isArray(value.lessons) ? value.lessons : [];
  return {
    title: typeof value.title === "string" ? value.title : "Untitled course",
    domain: typeof value.domain === "string" ? value.domain : "General",
    lessonCount: lessons.length,
  };
}

export async function loadTeachingOverview(
  db: SupabaseClient,
  userId: string,
): Promise<TeachingOverview> {
  const { data, error } = await db
    .from("courses")
    .select("id, document, status, visibility, updated_at")
    .eq("owner_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as CourseRow[];
  const courseIds = rows.map((row) => row.id);

  let enrolments: { course_id: string; student_id: string }[] = [];
  let invitations: { course_id: string; email: string }[] = [];
  if (courseIds.length) {
    const [enrolmentResult, invitationResult] = await Promise.all([
      db
        .from("course_enrolments")
        .select("course_id, student_id")
        .in("course_id", courseIds),
      db
        .from("course_invitations")
        .select("course_id, email")
        .in("course_id", courseIds),
    ]);
    if (enrolmentResult.error) throw enrolmentResult.error;
    if (invitationResult.error) throw invitationResult.error;
    enrolments = (enrolmentResult.data ?? []) as typeof enrolments;
    invitations = (invitationResult.data ?? []) as typeof invitations;
  }

  const studentsByCourse = new Map<string, number>();
  const studentIds = new Set<string>();
  for (const row of enrolments) {
    studentsByCourse.set(
      row.course_id,
      (studentsByCourse.get(row.course_id) ?? 0) + 1,
    );
    studentIds.add(row.student_id);
  }

  const invitationsByCourse = new Map<string, number>();
  for (const row of invitations) {
    invitationsByCourse.set(
      row.course_id,
      (invitationsByCourse.get(row.course_id) ?? 0) + 1,
    );
  }

  const courses = rows.map((row) => {
    const summary = documentSummary(row.document);
    return {
      id: row.id,
      title: summary.title,
      domain: summary.domain,
      status: asStatus(row.status),
      visibility: asVisibility(row.visibility),
      lessonCount: summary.lessonCount,
      studentCount: studentsByCourse.get(row.id) ?? 0,
      pendingInvitations: invitationsByCourse.get(row.id) ?? 0,
      updatedAt: row.updated_at,
    };
  });

  return {
    courses,
    totals: {
      courses: courses.length,
      published: courses.filter((course) => course.status === "published")
        .length,
      drafts: courses.filter((course) => course.status === "draft").length,
      archived: courses.filter((course) => course.status === "archived")
        .length,
      students: studentIds.size,
      pendingInvitations: invitations.length,
    },
  };
}

export function formatUpdatedAt(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(date);
}
