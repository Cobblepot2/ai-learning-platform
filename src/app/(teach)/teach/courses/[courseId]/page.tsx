import Link from "next/link";
import { buttonPrimary, buttonSecondary } from "@/components/blocks/BlockCard";
import { VisibilityLabel } from "@/components/teaching/CourseStatusBadge";
import {
  formatDateTime,
  loadCourseStats,
  loadRecentSubmissions,
  requireTeachingCourse,
} from "@/lib/teaching/course";

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

export default async function CourseOverviewPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const { db, course } = await requireTeachingCourse(courseId);
  const [stats, recent] = await Promise.all([
    loadCourseStats(db, course.id),
    loadRecentSubmissions(db, course, 6),
  ]);
  const document = course.document;

  const nextSteps: { text: string; href: string }[] = [];
  if (course.status === "archived") {
    nextSteps.push({
      text: "This course is archived. Publish it again from Settings when it is ready.",
      href: `/teach/courses/${course.id}/settings`,
    });
  } else if (!document.lessons.length) {
    nextSteps.push({
      text: "Add your first lesson in the curriculum editor.",
      href: `/teach/courses/${course.id}/curriculum`,
    });
  } else if (course.status === "draft") {
    nextSteps.push({
      text: "Review the curriculum, then publish the course for students.",
      href: `/teach/courses/${course.id}/settings`,
    });
  } else if (!stats.students) {
    nextSteps.push({
      text: "Invite your first students to this course.",
      href: `/teach/courses/${course.id}/students`,
    });
  }
  if (stats.invitations) {
    nextSteps.push({
      text: `${stats.invitations} invitation${
        stats.invitations === 1 ? " is" : "s are"
      } waiting to be claimed.`,
      href: `/teach/courses/${course.id}/students`,
    });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 lg:px-8">
      <section
        aria-label="Course overview"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <StatCard
          label="Students"
          value={stats.students}
          hint={`${stats.participants} submitted an activity`}
          href={`/teach/courses/${course.id}/students`}
        />
        <StatCard
          label="Submissions"
          value={stats.submissions}
          hint="Recorded activity attempts"
          href={`/teach/courses/${course.id}/students`}
        />
        <StatCard
          label="Lessons completed"
          value={stats.completions}
          hint="Across enrolled students"
          href={`/teach/courses/${course.id}/students`}
        />
        <StatCard
          label="Pending invitations"
          value={stats.invitations}
          hint="Not yet claimed"
          href={`/teach/courses/${course.id}/students`}
        />
      </section>

      {nextSteps.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-sm font-semibold text-amber-900">Next steps</h2>
          <ul className="mt-3 space-y-2 text-sm text-amber-900">
            {nextSteps.map((step) => (
              <li key={step.text}>
                <Link
                  href={step.href}
                  className="underline underline-offset-2 hover:text-amber-950"
                >
                  {step.text}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-stone-900">Curriculum</h2>
              <p className="mt-1 text-sm text-stone-500">
                {document.lessons.length} lesson
                {document.lessons.length === 1 ? "" : "s"} ·{" "}
                {document.estimatedMinutes} minutes · {document.level}
              </p>
            </div>
            <Link
              href={`/teach/courses/${course.id}/curriculum`}
              className={buttonSecondary}
            >
              Open editor
            </Link>
          </div>

          {document.lessons.length ? (
            <ol className="mt-5 divide-y divide-stone-100">
              {document.lessons.map((lesson, index) => (
                <li key={lesson.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-stone-100 text-xs font-semibold text-stone-600">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-stone-900">
                        {lesson.title}
                      </p>
                      <p className="mt-1 text-sm text-stone-500">
                        {lesson.blocks.length} activit
                        {lesson.blocks.length === 1 ? "y" : "ies"} ·{" "}
                        {lesson.minutes} min
                      </p>
                      {lesson.summary && (
                        <p className="mt-1 line-clamp-2 text-sm text-stone-600">
                          {lesson.summary}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="mt-5 rounded-xl border border-dashed border-stone-300 p-6 text-center">
              <p className="font-medium text-stone-800">
                This course has no lessons yet
              </p>
              <p className="mt-1 text-sm text-stone-500">
                Add a lesson by hand, or use the AI builder to draft the
                outline first.
              </p>
              <Link
                href={`/teach/courses/${course.id}/curriculum`}
                className={`${buttonPrimary} mt-4`}
              >
                Add the first lesson
              </Link>
            </div>
          )}
        </section>

        <div className="space-y-6">
          <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-stone-900">Course details</h2>
            {document.tagline && (
              <p className="mt-2 text-sm text-stone-600">{document.tagline}</p>
            )}
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-stone-500">Audience</dt>
                <dd className="mt-0.5 text-stone-800">
                  {document.targetAudience || "Not specified"}
                </dd>
              </div>
              <div>
                <dt className="text-stone-500">Access</dt>
                <dd className="mt-0.5">
                  <VisibilityLabel visibility={course.visibility} />
                </dd>
              </div>
              <div>
                <dt className="text-stone-500">Language</dt>
                <dd className="mt-0.5 text-stone-800">{document.language}</dd>
              </div>
              {document.objectives.length > 0 && (
                <div>
                  <dt className="text-stone-500">Learning objectives</dt>
                  <dd className="mt-1">
                    <ul className="list-inside list-disc space-y-1 text-stone-800">
                      {document.objectives.map((objective) => (
                        <li key={objective}>{objective}</li>
                      ))}
                    </ul>
                  </dd>
                </div>
              )}
            </dl>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href={`/teach/courses/${course.id}/settings`}
                className={buttonSecondary}
              >
                Publishing settings
              </Link>
            </div>
          </section>

          <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-stone-900">
                  Recent submissions
                </h2>
                <p className="mt-1 text-sm text-stone-500">
                  Latest activity from enrolled students.
                </p>
              </div>
              <Link
                href={`/teach/courses/${course.id}/students`}
                className="text-sm font-medium text-indigo-700 hover:underline"
              >
                View all
              </Link>
            </div>
            {recent.length ? (
              <ul className="mt-4 space-y-3">
                {recent.map((submission) => (
                  <li
                    key={submission.id}
                    className="rounded-xl border border-stone-100 bg-stone-50/70 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <Link
                        href={`/teach/courses/${course.id}/students/${submission.userId}`}
                        className="text-sm font-medium text-stone-900 hover:text-indigo-700"
                      >
                        {submission.studentName}
                      </Link>
                      <span className="shrink-0 text-xs text-stone-500">
                        {formatDateTime(submission.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-stone-600">
                      {submission.lessonTitle} · {submission.activityLabel}
                    </p>
                    <p className="mt-1 text-xs font-medium text-indigo-700">
                      {submission.score === null
                        ? "Qualitative feedback"
                        : `${Math.round(submission.score * 100)}%`}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-stone-500">
                No submissions yet. Activity appears here as students work
                through the course.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
