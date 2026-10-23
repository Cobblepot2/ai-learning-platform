import { notFound } from "next/navigation";
import { CoursePreferences } from "@/components/learning/CoursePreferences";
import { LessonList } from "@/components/LessonList";
import { readCourse } from "@/lib/learning/repository";

export default async function CoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const course = await readCourse(courseId);
  if (!course) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <span className="text-4xl">{course.emoji}</span>
      <h1 className="mt-4 text-3xl font-bold text-stone-900">{course.title}</h1>
      <p className="mt-2 text-lg text-stone-600">{course.tagline}</p>
      <p className="mt-4 text-stone-700">{course.description}</p>
      <CoursePreferences courseId={course.id} />
      <LessonList course={course} />
    </div>
  );
}
