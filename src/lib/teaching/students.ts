import type { SupabaseClient } from "@supabase/supabase-js";

type OwnedCourseRow = {
  id: string;
  document: unknown;
  status: string;
};

type EnrolmentRow = {
  course_id: string;
  student_id: string;
  created_at: string;
};

type AttemptRow = {
  user_id: string;
  created_at: string;
};

type ProgressRow = {
  user_id: string;
  course_id: string;
  lesson_id: string;
  completed_at: string | null;
  updated_at: string;
};

export type TeachingStudentCourse = {
  id: string;
  title: string;
  status: string;
};

export type TeachingStudent = {
  id: string;
  name: string;
  courses: TeachingStudentCourse[];
  completedLessons: number;
  submissions: number;
  lastActiveAt: string | null;
};

function courseTitle(document: unknown) {
  if (document && typeof document === "object" && "title" in document) {
    const title = (document as { title?: unknown }).title;
    if (typeof title === "string" && title.trim()) return title;
  }
  return "Untitled course";
}

export async function loadTeachingStudents(
  db: SupabaseClient,
  userId: string,
  query = "",
): Promise<TeachingStudent[]> {
  const { data: courseData, error: courseError } = await db
    .from("courses")
    .select("id, document, status")
    .eq("owner_id", userId);
  if (courseError) throw courseError;

  const courses = (courseData ?? []) as OwnedCourseRow[];
  if (!courses.length) return [];
  const courseIds = courses.map((course) => course.id);

  const [enrolmentResult, attemptResult, progressResult] = await Promise.all([
    db
      .from("course_enrolments")
      .select("course_id, student_id, created_at")
      .in("course_id", courseIds),
    db
      .from("learning_attempts")
      .select("user_id, created_at")
      .in("course_id", courseIds),
    db
      .from("lesson_progress")
      .select("user_id, course_id, lesson_id, completed_at, updated_at")
      .in("course_id", courseIds)
      .not("completed_at", "is", null),
  ]);
  for (const result of [enrolmentResult, attemptResult, progressResult]) {
    if (result.error) throw result.error;
  }

  const enrolments = (enrolmentResult.data ?? []) as EnrolmentRow[];
  const studentIds = [...new Set(enrolments.map((row) => row.student_id))];
  if (!studentIds.length) return [];

  const { data: profileData, error: profileError } = await db
    .from("profiles")
    .select("id, display_name")
    .in("id", studentIds);
  if (profileError) throw profileError;
  const names = new Map(
    (profileData ?? []).map((profile) => [
      profile.id as string,
      (profile.display_name as string | null)?.trim() || null,
    ]),
  );

  const courseById = new Map(courses.map((course) => [course.id, course]));
  const attempts = (attemptResult.data ?? []) as AttemptRow[];
  const progress = (progressResult.data ?? []) as ProgressRow[];
  const studentMap = new Map<string, TeachingStudent>();

  for (const enrolment of enrolments) {
    const student = studentMap.get(enrolment.student_id) ?? {
      id: enrolment.student_id,
      name:
        names.get(enrolment.student_id) ??
        `Student ${enrolment.student_id.slice(0, 8)}`,
      courses: [],
      completedLessons: 0,
      submissions: 0,
      lastActiveAt: null,
    };
    const course = courseById.get(enrolment.course_id);
    if (!course) continue;
    if (!student.courses.some((item) => item.id === course.id)) {
      student.courses.push({
        id: course.id,
        title: courseTitle(course.document),
        status: course.status,
      });
    }
    studentMap.set(enrolment.student_id, student);
  }

  for (const attempt of attempts) {
    const student = studentMap.get(attempt.user_id);
    if (!student) continue;
    student.submissions += 1;
    if (
      !student.lastActiveAt ||
      new Date(attempt.created_at) > new Date(student.lastActiveAt)
    ) {
      student.lastActiveAt = attempt.created_at;
    }
  }

  for (const row of progress) {
    const student = studentMap.get(row.user_id);
    if (!student) continue;
    if (student.courses.some((course) => course.id === row.course_id)) {
      student.completedLessons += 1;
    }
    if (
      row.updated_at &&
      (!student.lastActiveAt ||
        new Date(row.updated_at) > new Date(student.lastActiveAt))
    ) {
      student.lastActiveAt = row.updated_at;
    }
  }

  const needle = query.trim().toLowerCase();
  return [...studentMap.values()]
    .filter(
      (student) =>
        !needle ||
        student.name.toLowerCase().includes(needle) ||
        student.id.toLowerCase().includes(needle),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}
