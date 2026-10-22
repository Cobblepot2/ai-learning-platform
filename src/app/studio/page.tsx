import { CourseStudio } from "@/components/learning/CourseStudio";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ courseId?: string | string[] }>;
}) {
  const { courseId } = await searchParams;
  const initialCourseId = Array.isArray(courseId) ? courseId[0] : courseId;
  return (
    <CourseStudio
      key={initialCourseId ?? "new"}
      teacher
      initialCourseId={initialCourseId}
    />
  );
}
