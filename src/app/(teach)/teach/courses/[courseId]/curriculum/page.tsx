import { CourseStudio } from "@/components/learning/CourseStudio";
import { requireTeachingCourse } from "@/lib/teaching/course";

export const dynamic = "force-dynamic";

export default async function CourseCurriculumPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const { course } = await requireTeachingCourse(courseId);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-8">
      <CourseStudio
        key={course.id}
        teacher
        scoped
        serverAuthorized
        initialCourseId={course.id}
      />
    </div>
  );
}
