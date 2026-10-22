import { CourseSettings } from "@/components/teaching/CourseSettings";
import { requireTeachingCourse } from "@/lib/teaching/course";

export const dynamic = "force-dynamic";

export default async function CourseSettingsPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const { course } = await requireTeachingCourse(courseId);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 lg:px-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight text-stone-900">
          Settings
        </h2>
        <p className="mt-1 text-sm text-stone-600">
          Control who can open this course and when it becomes available.
        </p>
      </div>
      <CourseSettings course={course} />
    </div>
  );
}
