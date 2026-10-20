import { notFound } from "next/navigation";
import { LessonPlayer } from "@/components/LessonPlayer";
import { courses, getLesson } from "@/content/courses";

export function generateStaticParams() {
  return courses.flatMap((c) => c.lessons.map((l) => ({ courseId: c.id, lessonId: l.id })));
}

export default async function LessonPage({ params }: { params: Promise<{ courseId: string; lessonId: string }> }) {
  const { courseId, lessonId } = await params;
  const found = getLesson(courseId, lessonId);
  if (!found) notFound();
  return <LessonPlayer course={found.course} lesson={found.lesson} />;
}
