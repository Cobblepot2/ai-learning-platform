import Link from "next/link";
import { buttonPrimary, buttonSecondary } from "@/components/blocks/BlockCard";
import {
  CourseStatusBadge,
  VisibilityLabel,
} from "@/components/teaching/CourseStatusBadge";
import { requireAccount } from "@/lib/supabase/server";
import {
  formatUpdatedAt,
  loadTeachingOverview,
} from "@/lib/teaching/overview";

export const dynamic = "force-dynamic";

function StatCard({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: number;
  hint: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow-md"
    >
      <p className="text-sm font-medium text-stone-500">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-stone-900">
        {value}
      </p>
      <p className="mt-1 text-xs text-stone-500">{hint}</p>
    </Link>
  );
}

export default async function TeachingHomePage() {
  const { db, user } = await requireAccount(true);
  const overview = await loadTeachingOverview(db, user.id);
  const { totals } = overview;

  const attention = [
    totals.drafts
      ? {
          text: `${totals.drafts} draft${totals.drafts === 1 ? "" : "s"} waiting to be published`,
          href: "/teach/courses?status=draft",
        }
      : null,
    totals.pendingInvitations
      ? {
          text: `${totals.pendingInvitations} invitation${
            totals.pendingInvitations === 1 ? "" : "s"
          } not yet claimed`,
          href: "/teach/invitations",
        }
      : null,
  ].filter((item): item is { text: string; href: string } => !!item);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-indigo-600">Teaching studio</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-stone-900">
            Your courses, at a glance
          </h1>
          <p className="mt-2 max-w-2xl text-stone-600">
            Design reviewed learning experiences, invite students and follow
            their progress from one workspace.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/teach/courses" className={buttonSecondary}>
            All courses
          </Link>
          <Link href="/teach/courses/new" className={buttonPrimary}>
            New course
          </Link>
        </div>
      </header>

      <section
        aria-label="Teaching overview"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <StatCard
          label="Published"
          value={totals.published}
          hint="Live courses"
          href="/teach/courses?status=published"
        />
        <StatCard
          label="Drafts"
          value={totals.drafts}
          hint="Not published yet"
          href="/teach/courses?status=draft"
        />
        <StatCard
          label="Students"
          value={totals.students}
          hint="Unique enrolled learners"
          href="/teach/students"
        />
        <StatCard
          label="Pending invitations"
          value={totals.pendingInvitations}
          hint="Not yet claimed"
          href="/teach/invitations"
        />
      </section>

      {attention.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-sm font-semibold text-amber-900">
            Needs attention
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-amber-900">
            {attention.map((item) => (
              <li key={item.text}>
                <Link href={item.href} className="underline underline-offset-2">
                  {item.text}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold text-stone-900">Your courses</h2>
            <p className="mt-1 text-sm text-stone-500">
              {totals.courses} course{totals.courses === 1 ? "" : "s"} in your
              teaching workspace
            </p>
          </div>
          <Link
            href="/teach/courses"
            className="text-sm font-medium text-indigo-600 underline underline-offset-2"
          >
            View all
          </Link>
        </div>

        {overview.courses.length ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {overview.courses.slice(0, 4).map((course) => (
              <Link
                key={course.id}
                href={`/teach/courses/${course.id}`}
                className="group rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-stone-900 group-hover:text-indigo-700">
                      {course.title}
                    </h3>
                    <p className="mt-1 text-sm text-stone-500">
                      {course.domain} · {course.lessonCount} lesson
                      {course.lessonCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <CourseStatusBadge status={course.status} />
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-stone-600">
                  <span>{course.studentCount} students</span>
                  <span>{course.pendingInvitations} pending</span>
                  <VisibilityLabel visibility={course.visibility} />
                </div>
                <p className="mt-3 text-xs text-stone-400">
                  Updated {formatUpdatedAt(course.updatedAt)}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center">
            <h3 className="font-semibold text-stone-900">
              No courses in your teaching workspace yet
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-stone-600">
              Create a course, review the AI-assisted draft and publish it when
              it is ready for students.
            </p>
            <Link href="/teach/courses/new" className={`${buttonPrimary} mt-5`}>
              Create your first course
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
