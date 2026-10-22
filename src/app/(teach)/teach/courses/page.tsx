import Link from "next/link";
import { buttonPrimary } from "@/components/blocks/BlockCard";
import {
  CourseStatusBadge,
  VisibilityLabel,
} from "@/components/teaching/CourseStatusBadge";
import { requireAccount } from "@/lib/supabase/server";
import {
  formatUpdatedAt,
  loadTeachingOverview,
  type TeachingCourseStatus,
} from "@/lib/teaching/overview";

export const dynamic = "force-dynamic";

type StatusFilter = "all" | TeachingCourseStatus;

const statusFilters: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Drafts" },
  { value: "archived", label: "Archived" },
];

function readStatus(value: string | string[] | undefined): StatusFilter {
  const status = Array.isArray(value) ? value[0] : value;
  return status === "published" || status === "draft" || status === "archived"
    ? status
    : "all";
}

export default async function TeachingCoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  const { db, user } = await requireAccount(true);
  const overview = await loadTeachingOverview(db, user.id);
  const { status } = await searchParams;
  const active = readStatus(status);
  const courses =
    active === "all"
      ? overview.courses
      : overview.courses.filter((course) => course.status === active);

  const counts: Record<StatusFilter, number> = {
    all: overview.courses.length,
    published: overview.totals.published,
    draft: overview.totals.drafts,
    archived: overview.totals.archived,
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-indigo-600">Teaching studio</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-stone-900">
            Courses
          </h1>
          <p className="mt-2 max-w-2xl text-stone-600">
            Manage drafts, published courses, access settings and student
            rosters.
          </p>
        </div>
        <Link href="/teach/courses/new" className={buttonPrimary}>
          New course
        </Link>
      </header>

      <nav
        aria-label="Filter courses by status"
        className="flex flex-wrap gap-2"
      >
        {statusFilters.map((filter) => {
          const selected = active === filter.value;
          return (
            <Link
              key={filter.value}
              href={
                filter.value === "all"
                  ? "/teach/courses"
                  : `/teach/courses?status=${filter.value}`
              }
              aria-current={selected ? "page" : undefined}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                selected
                  ? "border-stone-900 bg-stone-900 text-white"
                  : "border-stone-300 bg-white text-stone-600 hover:border-stone-400 hover:text-stone-900"
              }`}
            >
              {filter.label}
              <span
                className={`ml-2 text-xs ${selected ? "text-stone-300" : "text-stone-400"}`}
              >
                {counts[filter.value]}
              </span>
            </Link>
          );
        })}
      </nav>

      {courses.length ? (
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Course</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Access</th>
                  <th className="px-4 py-3 font-medium">Students</th>
                  <th className="px-4 py-3 font-medium">Lessons</th>
                  <th className="px-4 py-3 font-medium">Pending</th>
                  <th className="px-4 py-3 font-medium">Updated</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {courses.map((course) => (
                  <tr key={course.id} className="hover:bg-stone-50/70">
                    <td className="px-5 py-4">
                      <Link
                        href={`/teach/courses/${course.id}`}
                        className="font-semibold text-stone-900 hover:text-indigo-700"
                      >
                        {course.title}
                      </Link>
                      <p className="mt-0.5 text-xs text-stone-500">
                        {course.domain}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <CourseStatusBadge status={course.status} />
                    </td>
                    <td className="px-4 py-4">
                      <VisibilityLabel visibility={course.visibility} />
                    </td>
                    <td className="px-4 py-4 text-stone-700">
                      {course.studentCount}
                    </td>
                    <td className="px-4 py-4 text-stone-700">
                      {course.lessonCount}
                    </td>
                    <td className="px-4 py-4 text-stone-700">
                      {course.pendingInvitations}
                    </td>
                    <td className="px-4 py-4 text-stone-500">
                      {formatUpdatedAt(course.updatedAt)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-3 whitespace-nowrap">
                        <Link
                          href={`/teach/courses/${course.id}/curriculum`}
                          className="font-medium text-indigo-700 hover:underline"
                        >
                          Edit
                        </Link>
                        <Link
                          href={`/courses/${course.id}`}
                          className="text-stone-600 hover:underline"
                        >
                          View
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <h2 className="font-semibold text-stone-900">
            {active === "all"
              ? "No courses yet"
              : `No ${active === "draft" ? "drafts" : active} courses`}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-stone-600">
            {active === "all"
              ? "Create your first course in the studio, review it carefully, then publish it for students."
              : "Try another status filter or create a new course."}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            {active !== "all" && (
              <Link
                href="/teach/courses"
                className="inline-flex items-center justify-center rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
              >
                Clear filter
              </Link>
            )}
            <Link href="/teach/courses/new" className={buttonPrimary}>
              New course
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
