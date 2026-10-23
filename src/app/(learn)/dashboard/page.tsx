"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Course } from "@/lib/types";
import { catalogCourses } from "@/content/courses";
import { useLearner } from "@/lib/learner-store";
import { GOAL_LABELS, LEARNING_STYLE_LABELS } from "@/lib/types";
import {
  ContinueLearning,
  CourseProgressList,
  ProgressStats,
} from "@/components/learning/ProgressSummary";

export default function DashboardPage() {
  const [courses, setCourses] = useState<Course[]>(catalogCourses);
  useEffect(() => {
    fetch("/api/courses?accessible=1")
      .then((r) => r.json())
      .then((rows) => {
        if (!Array.isArray(rows)) return;
        const stored = rows
          .map((row: { document?: Course }) => row.document)
          .filter((c: Course | undefined): c is Course => !!c?.id);
        const seen = new Set(catalogCourses.map((c) => c.id));
        setCourses([
          ...catalogCourses,
          ...stored.filter((c: Course) => !seen.has(c.id)),
        ]);
      })
      .catch(() => {});
  }, []);
  const { ready, profile, progress } = useLearner();
  if (!ready) return null;

  const allLessons = courses.flatMap((c) =>
    c.lessons.map((l) => ({ course: c, lesson: l })),
  );
  const completed = allLessons.filter(
    ({ course, lesson }) => progress[`${course.id}/${lesson.id}`]?.completedAt,
  );
  const activitiesDone = Object.values(progress).reduce(
    (n, p) => n + Object.values(p.blocks).filter((b) => b.done).length,
    0,
  );
  const scores = Object.values(progress).flatMap((p) =>
    Object.values(p.blocks).flatMap((b) =>
      typeof b.score === "number" ? [b.score] : [],
    ),
  );
  const avg = scores.length
    ? Math.round(
        (scores.reduce((a, b) => a + b, 0) / scores.length) * 100,
      )
    : null;
  const next = allLessons.find(
    ({ course, lesson }) => !progress[`${course.id}/${lesson.id}`]?.completedAt,
  );
  const started = completed.length > 0;

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold text-stone-900">
        {profile?.displayName ? `${profile.displayName}'s progress` : "My progress"}
      </h1>
      {profile ? (
        <p className="mt-2 text-stone-600">
          {GOAL_LABELS[profile.goal]} ·{" "}
          {LEARNING_STYLE_LABELS[profile.learningStyle]}
        </p>
      ) : (
        <p className="mt-2 text-stone-600">
          <Link href="/onboarding" className="text-indigo-600 underline">
            Set your learning preferences
          </Link>{" "}
          to get personalised explanations.
        </p>
      )}

      <div className="mt-8">
        <ProgressStats
          completed={completed.length}
          total={allLessons.length}
          activities={activitiesDone}
          average={avg}
        />
      </div>

      {next && (
        <div className="mt-8">
          <ContinueLearning
            course={next.course}
            lesson={next.lesson}
            started={started}
          />
        </div>
      )}

      <div className="mt-10">
        <CourseProgressList courses={courses} progress={progress} />
      </div>
    </div>
  );
}
