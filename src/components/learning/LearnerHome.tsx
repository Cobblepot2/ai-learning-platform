"use client";

import Link from "next/link";
import { CourseCard } from "@/components/CourseCard";
import {
  ContinueLearning,
  ProgressStats,
} from "@/components/learning/ProgressSummary";
import { useLearner, type ProgressMap } from "@/lib/learner-store";
import {
  GOAL_LABELS,
  LEARNING_STYLE_LABELS,
  type Course,
} from "@/lib/types";

function isStarted(progress: ProgressMap, course: Course) {
  return course.lessons.some((lesson) => {
    const p = progress[`${course.id}/${lesson.id}`];
    return (
      !!p?.completedAt || Object.values(p?.blocks ?? {}).some((b) => b.done)
    );
  });
}

export function LearnerHome({ courses }: { courses: Course[] }) {
  const { ready, profile, progress } = useLearner();

  if (!ready) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-10">
        <div className="h-9 w-64 animate-pulse rounded bg-stone-200" />
        <div className="h-5 w-80 animate-pulse rounded bg-stone-100" />
        <div className="h-28 animate-pulse rounded-2xl bg-stone-100" />
      </div>
    );
  }

  const startedIds = new Set(
    courses.filter((course) => isStarted(progress, course)).map((c) => c.id),
  );
  const startedCourses = courses.filter((course) => startedIds.has(course.id));
  const newCourses = courses.filter((course) => !startedIds.has(course.id));
  const orderedCourses = [...startedCourses, ...newCourses];

  const allLessons = orderedCourses.flatMap((course) =>
    course.lessons.map((lesson) => ({ course, lesson })),
  );
  const completed = allLessons.filter(
    ({ course, lesson }) =>
      progress[`${course.id}/${lesson.id}`]?.completedAt,
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
  const average = scores.length
    ? Math.round(
        (scores.reduce((a, b) => a + b, 0) / scores.length) * 100,
      )
    : null;
  const next = allLessons.find(
    ({ course, lesson }) => !progress[`${course.id}/${lesson.id}`]?.completedAt,
  );
  const started = startedIds.size > 0;

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-10">
      <header>
        <h1 className="text-3xl font-bold text-stone-900">
          {profile?.displayName
            ? `Welcome back, ${profile.displayName}`
            : "Welcome back"}
        </h1>
        {profile ? (
          <p className="mt-2 text-stone-600">
            {GOAL_LABELS[profile.goal]} ·{" "}
            {LEARNING_STYLE_LABELS[profile.learningStyle]}
            <Link
              href="/onboarding"
              className="ml-3 text-sm text-indigo-600 underline"
            >
              Edit preferences
            </Link>
          </p>
        ) : (
          <p className="mt-2 text-stone-600">
            <Link href="/onboarding" className="text-indigo-600 underline">
              Set your learning preferences
            </Link>{" "}
            to get explanations that match how you like to learn.
          </p>
        )}
      </header>

      {next ? (
        <ContinueLearning
          course={next.course}
          lesson={next.lesson}
          started={started}
        />
      ) : (
        courses.length > 0 && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <p className="font-semibold text-emerald-900">
              You have completed every available lesson.
            </p>
            <p className="mt-1 text-sm text-emerald-800">
              Ask your teacher for a new course, or create a private one in My
              courses.
            </p>
          </div>
        )
      )}

      <ProgressStats
        completed={completed.length}
        total={allLessons.length}
        activities={activitiesDone}
        average={average}
      />

      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-bold text-stone-900">My learning</h2>
          <Link href="/dashboard" className="text-sm text-indigo-600 underline">
            Detailed progress
          </Link>
        </div>
        {startedCourses.length ? (
          <div className="mt-4 grid gap-5 md:grid-cols-2">
            {startedCourses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-2xl border border-dashed border-stone-300 bg-white p-5 text-sm text-stone-600">
            Nothing in progress yet. Pick a course below to start, or{" "}
            <Link href="/onboarding" className="text-indigo-600 underline">
              personalise your learning
            </Link>
            .
          </p>
        )}
      </section>

      {courses.length > 0 && (
        <section id="courses" className="scroll-mt-20">
          <h2 className="text-xl font-bold text-stone-900">Explore courses</h2>
          {newCourses.length ? (
            <div className="mt-4 grid gap-5 md:grid-cols-2">
              {newCourses.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-stone-600">
              You have already started every available course.
            </p>
          )}
        </section>
      )}

      {courses.length === 0 && (
        <p className="rounded-2xl border border-dashed border-stone-300 bg-white p-5 text-sm text-stone-600">
          No courses are available yet.
        </p>
      )}
    </div>
  );
}
