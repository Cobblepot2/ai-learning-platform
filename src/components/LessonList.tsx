"use client";

import Link from "next/link";
import { useLearner } from "@/lib/learner-store";
import { activityDefinitions } from "@/lib/learning/registry";
import type { Course } from "@/lib/types";

export function LessonList({ course }: { course: Course }) {
  const { progress } = useLearner();
  const nextIndex = course.lessons.findIndex((l) => !progress[`${course.id}/${l.id}`]?.completedAt);

  return (
    <ol className="mt-10 space-y-3">
      {course.lessons.map((lesson, i) => {
        const done = Boolean(progress[`${course.id}/${lesson.id}`]?.completedAt);
        const formats = [
          ...new Set(
            lesson.blocks.flatMap((block) =>
              block.type === "activity" && block.activityType in activityDefinitions
                ? [
                    activityDefinitions[
                      block.activityType as keyof typeof activityDefinitions
                    ].label,
                  ]
                : [],
            ),
          ),
        ];
        return (
          <li key={lesson.id}>
            <Link
              href={`/courses/${course.id}/${lesson.id}`}
              className={`flex items-start gap-4 rounded-2xl border bg-white p-5 transition hover:border-indigo-300 hover:shadow-sm ${
                i === nextIndex ? "border-indigo-300 ring-2 ring-indigo-100" : "border-stone-200"
              }`}
            >
              <span
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-semibold ${
                  done ? "bg-emerald-100 text-emerald-700" : "bg-stone-100 text-stone-600"
                }`}
              >
                {done ? "✓" : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className="font-semibold text-stone-900">{lesson.title}</p>
                  <span className="text-xs text-stone-500">{lesson.minutes} min</span>
                </div>
                <p className="mt-1 text-sm text-stone-600">{lesson.summary}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {formats.map((f) => (
                    <span key={f} className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
                      {f}
                    </span>
                  ))}
                  {i === nextIndex && <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-xs text-white">Up next</span>}
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
