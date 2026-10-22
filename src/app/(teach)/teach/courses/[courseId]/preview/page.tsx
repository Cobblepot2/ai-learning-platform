import { CoursePreview } from "@/components/teaching/CoursePreview";
import { requireTeachingCourse } from "@/lib/teaching/course";

export const dynamic = "force-dynamic";

export default async function CoursePreviewPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const { course } = await requireTeachingCourse(courseId);
  return <CoursePreview course={course} />;
}
