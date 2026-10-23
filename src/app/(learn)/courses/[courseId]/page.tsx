import { notFound } from "next/navigation";
import { CoursePreferences } from "@/components/learning/CoursePreferences";
import { LessonList } from "@/components/LessonList";
import { isDatabaseCourseId } from "@/lib/learning/ids";
import { readCourse } from "@/lib/learning/repository";
import { redactCourseSimulations } from "@/lib/learning/simulation/public";

export default async function CoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const loaded = await readCourse(courseId);
  if (!loaded) notFound();
  const course = isDatabaseCourseId(courseId)
    ? redactCourseSimulations(loaded)
    : loaded;

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
