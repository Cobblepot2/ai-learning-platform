import { Analytics } from "@/components/learning/Analytics";
import { requireTeachingCourse } from "@/lib/teaching/course";

export const dynamic = "force-dynamic";

export default async function CourseStudentsPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const { course } = await requireTeachingCourse(courseId);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 lg:px-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-stone-900">
          Students
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-stone-600">
          Invite students to {course.document.title}, review their lesson
          progress and open individual submissions.
        </p>
      </div>
      <Analytics courseId={course.id} />
    </div>
  );
}
