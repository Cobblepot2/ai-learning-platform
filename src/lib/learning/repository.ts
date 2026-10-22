import { getCourse as staticCourse, courses } from "@/content/courses";
import { serverDb, HttpError } from "@/lib/supabase/server";
import { adaptStaticCourse } from "./legacy";
import { parseCourse, type CourseRecord } from "./model";
import type { Course } from "@/lib/types";

export async function readCourse(id: string): Promise<Course | undefined> {
  const demo = staticCourse(id);
  if (demo) return adaptStaticCourse(demo);
  const db = await serverDb();
  if (!db) return undefined;
  const { data, error } = await db
    .from("courses")
    .select("document")
    .eq("id", id)
    .maybeSingle();
  if (error)
    throw new HttpError(
      503,
      "Course storage unavailable. Apply the database migrations.",
    );
  return data ? parseCourse(data.document) : undefined;
}
export async function readLesson(courseId: string, lessonId: string) {
  const course = await readCourse(courseId);
  const lesson = course?.lessons.find((l) => l.id === lessonId);
  return course && lesson ? { course, lesson } : undefined;
}
export async function listCourses(): Promise<Course[]> {
  const db = await serverDb();
  if (!db) return courses.map(adaptStaticCourse);
  const { data, error } = await db
    .from("courses")
    .select("document")
    .eq("status", "published");
  if (error)
    throw new HttpError(
      503,
      "Course storage unavailable. Apply the database migrations.",
    );
  return [
    ...courses.map(adaptStaticCourse),
    ...(data ?? []).map((row) => parseCourse(row.document)),
  ];
}
export async function ownedCourse(
  id: string,
  db: NonNullable<Awaited<ReturnType<typeof serverDb>>>,
  userId: string,
) {
  const { data, error } = await db
    .from("courses")
    .select("*")
    .eq("id", id)
    .eq("owner_id", userId)
    .maybeSingle();
  if (error || !data) throw new HttpError(404, "Course not found.");
  return data as CourseRecord;
}
