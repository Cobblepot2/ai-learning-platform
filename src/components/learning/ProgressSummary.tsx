import Link from "next/link";
import type { Course, Lesson } from "@/lib/types";
import type { ProgressMap } from "@/lib/learner-store";

export function ContinueLearning({
  course,
  lesson,
  started,
}: {
  course: Course;
  lesson: Lesson;
  started: boolean;
}) {
  return (
    <Link
      href={`/courses/${course.id}/${lesson.id}`}
      className="flex items-center justify-between gap-4 rounded-2xl bg-indigo-600 p-5 text-white hover:bg-indigo-700"
    >
      <div>
        <p className="text-sm text-indigo-100">
          {started ? "Continue learning" : "Start learning"}
        </p>
        <p className="font-semibold">{lesson.title}</p>
        <p className="mt-0.5 text-sm text-indigo-100">
          {course.title} · {lesson.minutes} min
        </p>
      </div>
      <span aria-hidden className="text-2xl">
        →
      </span>
    </Link>
  );
}

export function ProgressStats({
  completed,
  total,
  activities,
  average,
}: {
  completed: number;
  total: number;
  activities: number;
  average: number | null;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Stat label="Lessons completed" value={`${completed} / ${total}`} />
      <Stat label="Activities done" value={String(activities)} />
      <Stat
        label="Average scored activity result"
        value={average === null ? "–" : `${average}%`}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5">
      <p className="text-sm text-stone-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-stone-900">{value}</p>
    </div>
  );
}

/** Lesson-by-lesson progress for the detailed progress page. */
export function CourseProgressList({
  courses,
  progress,
}: {
  courses: Course[];
  progress: ProgressMap;
}) {
  return (
    <div className="space-y-6">
      {courses.map((course) => (
        <div key={course.id}>
          <h2 className="font-semibold text-stone-900">
            {course.emoji} {course.title}
          </h2>
          <ul className="mt-3 divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
            {course.lessons.map((lesson) => {
              const p = progress[`${course.id}/${lesson.id}`];
              const activities = lesson.blocks.filter(
                (block) =>
                  !(
                    block.type === "activity" &&
                    block.activityType === "reading"
                  ),
              );
              const done = activities.filter((b) => p?.blocks[b.id]?.done).length;
              return (
                <li
                  key={lesson.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                >
                  <Link
                    href={`/courses/${course.id}/${lesson.id}`}
                    className="text-stone-800 hover:text-indigo-600"
                  >
                    {lesson.title}
                  </Link>
                  <span
                    className={
                      p?.completedAt ? "text-emerald-700" : "text-stone-500"
                    }
                  >
                    {p?.completedAt
                      ? "Completed"
                      : `${done}/${activities.length} activities`}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
