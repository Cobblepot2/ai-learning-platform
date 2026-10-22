import Link from "next/link";
import { buttonSecondary } from "@/components/blocks/BlockCard";
import { activityDefinitions } from "@/lib/learning/registry";
import {
  GOAL_LABELS,
  LANGUAGE_LABELS,
  LEARNING_STYLE_LABELS,
} from "@/lib/types";
import {
  formatDateTime,
  loadCourseStudent,
  requireTeachingCourse,
  studentLabel,
} from "@/lib/teaching/course";

export const dynamic = "force-dynamic";

function profileValue(value: string | null, labels: Record<string, string>) {
  if (!value) return null;
  return labels[value] ?? value.replaceAll("_", " ");
}

export default async function CourseStudentPage({
  params,
}: {
  params: Promise<{ courseId: string; studentId: string }>;
}) {
  const { courseId, studentId } = await params;
  const { db, course } = await requireTeachingCourse(courseId);
  const detail = await loadCourseStudent(db, course.id, studentId);

  const name = studentLabel(detail.profile, studentId);
  const lessons = course.document.lessons;
  const completed = new Set(
    detail.progress
      .filter((row) => row.completed_at)
      .map((row) => row.lesson_id),
  );
  const touched = new Set([
    ...detail.progress.map((row) => row.lesson_id),
    ...detail.attempts.map((attempt) => attempt.lesson_id),
  ]);
  const lessonTitles = new Map(
    lessons.map((lesson) => [lesson.id, lesson.title]),
  );
  const scored = detail.attempts.filter(
    (attempt) => attempt.score !== null,
  ) as (typeof detail.attempts[number] & { score: number })[];
  const average = scored.length
    ? Math.round(
        (scored.reduce((sum, attempt) => sum + attempt.score, 0) /
          scored.length) *
          100,
      )
    : null;
  const lastActive = detail.attempts[0]?.created_at
    ? formatDateTime(detail.attempts[0].created_at)
    : detail.progress[0]?.updated_at
      ? formatDateTime(detail.progress[0].updated_at)
      : "No activity yet";

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 lg:px-8">
      <div>
        <Link
          href={`/teach/courses/${course.id}/students`}
          className="text-sm font-medium text-stone-500 transition hover:text-indigo-700"
        >
          ← Back to students
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-stone-900">
              {name}
            </h2>
            <p className="mt-1 text-sm text-stone-600">
              {course.document.title} · enrolled{" "}
              {formatDateTime(detail.enrolledAt)}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-stone-600">
              {profileValue(detail.profile?.goal ?? null, GOAL_LABELS) && (
                <span className="rounded-full bg-stone-100 px-2.5 py-1">
                  {profileValue(detail.profile?.goal ?? null, GOAL_LABELS)}
                </span>
              )}
              {profileValue(
                detail.profile?.learning_style ?? null,
                LEARNING_STYLE_LABELS,
              ) && (
                <span className="rounded-full bg-stone-100 px-2.5 py-1">
                  {profileValue(
                    detail.profile?.learning_style ?? null,
                    LEARNING_STYLE_LABELS,
                  )}
                </span>
              )}
              {profileValue(
                detail.profile?.language ?? null,
                LANGUAGE_LABELS,
              ) && (
                <span className="rounded-full bg-stone-100 px-2.5 py-1">
                  {profileValue(
                    detail.profile?.language ?? null,
                    LANGUAGE_LABELS,
                  )}
                </span>
              )}
            </div>
          </div>
          <Link
            href={`/teach/courses/${course.id}/students`}
            className={buttonSecondary}
          >
            Manage roster
          </Link>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-stone-500">Lessons complete</p>
          <p className="mt-2 text-3xl font-bold text-stone-900">
            {completed.size}
            <span className="text-base font-medium text-stone-400">
              /{lessons.length}
            </span>
          </p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-stone-500">Submissions</p>
          <p className="mt-2 text-3xl font-bold text-stone-900">
            {detail.attempts.length}
          </p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-stone-500">Average quiz score</p>
          <p className="mt-2 text-3xl font-bold text-stone-900">
            {average === null ? "—" : `${average}%`}
          </p>
          <p className="mt-1 text-xs text-stone-500">Last activity {lastActive}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-bold text-stone-900">Lesson progress</h3>
        {lessons.length ? (
          <ol className="mt-4 divide-y divide-stone-100">
            {lessons.map((lesson, index) => {
              const isComplete = completed.has(lesson.id);
              const isTouched = touched.has(lesson.id);
              return (
                <li
                  key={lesson.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex items-center gap-3">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-stone-100 text-xs font-semibold text-stone-600">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-medium text-stone-900">
                        {lesson.title}
                      </p>
                      <p className="text-xs text-stone-500">
                        {lesson.blocks.length} activit
                        {lesson.blocks.length === 1 ? "y" : "ies"}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                      isComplete
                        ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                        : isTouched
                          ? "bg-amber-50 text-amber-700 ring-amber-200"
                          : "bg-stone-50 text-stone-500 ring-stone-200"
                    }`}
                  >
                    {isComplete
                      ? "Complete"
                      : isTouched
                        ? "Started"
                        : "Not started"}
                  </span>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="mt-3 text-sm text-stone-500">
            This course has no lessons yet.
          </p>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-bold text-stone-900">Submissions</h3>
          <p className="mt-1 text-sm text-stone-500">
            Every submitted response for this course, newest first.
          </p>
        </div>

        {detail.attempts.length ? (
          detail.attempts.map((attempt) => {
            const lesson = lessons.find(
              (candidate) => candidate.id === attempt.lesson_id,
            );
            const block = lesson?.blocks.find(
              (candidate) => candidate.id === attempt.activity_id,
            );
            return (
              <details
                key={attempt.id}
                className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
              >
                <summary className="cursor-pointer list-none">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-stone-900">
                        {lessonTitles.get(attempt.lesson_id) ??
                          "Removed lesson"}{" "}
                        ·{" "}
                        {block
                          ? activityDefinitions[block.activityType].label
                          : "Removed activity"}
                      </p>
                      <p className="mt-1 text-xs text-stone-500">
                        {formatDateTime(attempt.created_at)} · revision{" "}
                        {attempt.course_revision}
                      </p>
                    </div>
                    <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                      {attempt.score === null
                        ? "Qualitative"
                        : `${Math.round(attempt.score * 100)}%`}
                    </span>
                  </div>
                </summary>

                <div className="mt-4 space-y-4 border-t border-stone-100 pt-4 text-sm">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
                      Response
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-stone-800">
                      {attempt.response}
                    </p>
                  </div>
                  {attempt.feedback?.summary && (
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
                        Feedback
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-stone-800">
                        {attempt.feedback.summary}
                      </p>
                    </div>
                  )}
                  {attempt.feedback?.characterReply && (
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
                        Character response
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-stone-800">
                        {attempt.feedback.characterReply}
                      </p>
                    </div>
                  )}
                  {!!attempt.feedback?.criteria?.length && (
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
                        Criteria
                      </p>
                      <ul className="mt-2 space-y-2">
                        {attempt.feedback.criteria.map((criterion, index) => (
                          <li
                            key={`${criterion.criterion}-${index}`}
                            className="rounded-lg bg-stone-50 p-3"
                          >
                            <p className="font-medium text-stone-800">
                              {criterion.criterion} — {criterion.assessment}
                            </p>
                            <p className="mt-1 text-stone-600">
                              {criterion.evidence}
                            </p>
                            <p className="mt-1 text-stone-500">
                              {criterion.suggestion}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {attempt.feedback?.nextStep && (
                    <p className="rounded-lg bg-indigo-50 p-3 text-indigo-900">
                      <span className="font-medium">Next step:</span>{" "}
                      {attempt.feedback.nextStep}
                    </p>
                  )}
                </div>
              </details>
            );
          })
        ) : (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center">
            <p className="font-medium text-stone-800">No submissions yet</p>
            <p className="mt-1 text-sm text-stone-500">
              {name} has not submitted an activity in this course.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
