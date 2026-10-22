import type { SupabaseClient } from "@supabase/supabase-js";

type CourseRow = {
  id: string;
  document: unknown;
  status: string;
};

type InvitationRow = {
  course_id: string;
  email: string;
  created_at: string;
};

export type TeachingInvitation = {
  email: string;
  createdAt: string;
  courseId: string;
  courseTitle: string;
  courseStatus: string;
};

function courseTitle(document: unknown) {
  if (document && typeof document === "object" && "title" in document) {
    const title = (document as { title?: unknown }).title;
    if (typeof title === "string" && title.trim()) return title;
  }
  return "Untitled course";
}

export async function loadTeachingInvitations(
  db: SupabaseClient,
  userId: string,
): Promise<TeachingInvitation[]> {
  const { data: courseData, error: courseError } = await db
    .from("courses")
    .select("id, document, status")
    .eq("owner_id", userId);
  if (courseError) throw courseError;

  const courses = (courseData ?? []) as CourseRow[];
  if (!courses.length) return [];
  const courseIds = courses.map((course) => course.id);
  const courseById = new Map(courses.map((course) => [course.id, course]));

  const { data, error } = await db
    .from("course_invitations")
    .select("course_id, email, created_at")
    .in("course_id", courseIds)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return ((data ?? []) as InvitationRow[]).flatMap((invitation) => {
    const course = courseById.get(invitation.course_id);
    if (!course) return [];
    return [
      {
        email: invitation.email,
        createdAt: invitation.created_at,
        courseId: course.id,
        courseTitle: courseTitle(course.document),
        courseStatus: course.status,
      },
    ];
  });
}
