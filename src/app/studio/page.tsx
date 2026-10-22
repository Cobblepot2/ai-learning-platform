import { redirect } from "next/navigation";

/** Compatibility entry point for links saved before the teaching workspace moved. */
export default async function LegacyStudioPage({
  searchParams,
}: {
  searchParams: Promise<{ courseId?: string | string[] }>;
}) {
  const { courseId } = await searchParams;
  const id = Array.isArray(courseId) ? courseId[0] : courseId;
  redirect(
    id ? `/teach/courses/${encodeURIComponent(id)}/curriculum` : "/teach/courses/new",
  );
}
