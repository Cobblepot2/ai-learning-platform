import { notFound } from "next/navigation";
import { LessonPlayer } from "@/components/LessonPlayer";
import { isDatabaseCourseId } from "@/lib/learning/ids";
import { readLesson } from "@/lib/learning/repository";
import { redactCourseSimulations } from "@/lib/learning/simulation/public";

export default async function LessonPage({ params }: { params: Promise<{ courseId: string; lessonId: string }> }) {
  const { courseId, lessonId } = await params;
  const found = await readLesson(courseId, lessonId);
  if (!found) notFound();
  // Students of a saved course must not receive stages, rules or hidden state.
  // Preview and static courses keep the full config so the engine can run locally.
  const course = isDatabaseCourseId(courseId)
    ? redactCourseSimulations(found.course)
    : found.course;
  const lesson = course.lessons.find((item) => item.id === lessonId) ?? found.lesson;
  return <LessonPlayer course={course} lesson={lesson} />;
}
