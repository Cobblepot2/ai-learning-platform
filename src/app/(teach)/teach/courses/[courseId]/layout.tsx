import Link from "next/link";
import { buttonPrimary, buttonSecondary } from "@/components/blocks/BlockCard";
import { CourseWorkspaceNav } from "@/components/teaching/CourseWorkspaceNav";
import {
  CourseStatusBadge,
  VisibilityLabel,
} from "@/components/teaching/CourseStatusBadge";
import { requireTeachingCourse } from "@/lib/teaching/course";
import { formatUpdatedAt } from "@/lib/teaching/overview";

export const dynamic = "force-dynamic";

export default async function CourseWorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const { course } = await requireTeachingCourse(courseId);
  const document = course.document;

  return (
    <div>
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 pt-6 lg:px-8">
          <Link
            href="/teach/courses"
            className="text-sm font-medium text-stone-500 transition hover:text-indigo-700"
          >
            ← All courses
          </Link>

          <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
                  {document.title}
                </h1>
                <CourseStatusBadge status={course.status} />
              </div>
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-stone-500">
                <span>{document.domain}</span>
                <span aria-hidden>·</span>
                <span>
                  {document.lessons.length} lesson
                  {document.lessons.length === 1 ? "" : "s"}
                </span>
                <span aria-hidden>·</span>
                <VisibilityLabel visibility={course.visibility} />
                <span aria-hidden>·</span>
                <span>Updated {formatUpdatedAt(course.updated_at ?? null)}</span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/courses/${course.id}`} className={buttonSecondary}>
                View learner page
              </Link>
              <Link
                href={`/teach/courses/${course.id}/curriculum`}
                className={buttonPrimary}
              >
                Edit curriculum
              </Link>
            </div>
          </div>

          <CourseWorkspaceNav courseId={course.id} />
        </div>
      </header>

      {children}
    </div>
  );
}
