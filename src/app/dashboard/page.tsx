"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Course } from "@/lib/types";
import { courses as demos } from "@/content/courses";
import { useLearner } from "@/lib/learner-store";
import { BACKGROUND_LABELS, GOAL_LABELS } from "@/lib/types";

export default function DashboardPage() {
  const [courses, setCourses] = useState<Course[]>(demos);
  useEffect(() => { fetch("/api/courses?accessible=1").then(r => r.json()).then(rows => { if (Array.isArray(rows)) setCourses([...demos, ...rows.map(r => r.document)]); }).catch(() => {}); }, []);
  const { ready, profile, progress } = useLearner();
  if (!ready) return null;

  const allLessons = courses.flatMap((c) => c.lessons.map((l) => ({ course: c, lesson: l })));
  const completed = allLessons.filter(({ course, lesson }) => progress[`${course.id}/${lesson.id}`]?.completedAt);
  const scores = Object.values(progress).flatMap((p) =>
    Object.values(p.blocks).flatMap((b) => (typeof b.score === "number" ? [b.score] : [])),
  );
  const avg = scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) : null;
  const next = allLessons.find(({ course, lesson }) => !progress[`${course.id}/${lesson.id}`]?.completedAt);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold text-stone-900">
        {profile?.displayName ? `${profile.displayName}'s progress` : "My progress"}
      </h1>
      {profile ? (
        <p className="mt-2 text-stone-600">
          {BACKGROUND_LABELS[profile.background]} · Goal: {GOAL_LABELS[profile.goal].toLowerCase()}
        </p>
      ) : (
        <p className="mt-2 text-stone-600">
          <Link href="/onboarding" className="text-indigo-600 underline">
            Set up your profile
          </Link>{" "}
          to get personalised explanations.
        </p>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Stat label="Lessons completed" value={`${completed.length} / ${allLessons.length}`} />
        <Stat label="Activities done" value={String(Object.values(progress).reduce((n,p)=>n+Object.values(p.blocks).filter(b=>b.done).length,0))} />
        <Stat label="Average scored activity result" value={avg === null ? "–" : `${avg}%`} />
      </div>

      {next && (
        <Link
          href={`/courses/${next.course.id}/${next.lesson.id}`}
          className="mt-8 flex items-center justify-between gap-4 rounded-2xl bg-indigo-600 p-5 text-white hover:bg-indigo-700"
        >
          <div>
            <p className="text-sm text-indigo-100">Continue learning</p>
            <p className="font-semibold">{next.lesson.title}</p>
          </div>
          <span className="text-2xl">→</span>
        </Link>
      )}

      <div className="mt-10 space-y-6">
        {courses.map((course) => (
          <div key={course.id}>
            <h2 className="font-semibold text-stone-900">
              {course.emoji} {course.title}
            </h2>
            <ul className="mt-3 divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
              {course.lessons.map((lesson) => {
                const p = progress[`${course.id}/${lesson.id}`];
                const activities = lesson.blocks.filter((b) => b.type !== "text" && !(b.type === "activity" && b.activityType === "reading"));
                const done = activities.filter((b) => p?.blocks[b.id]?.done).length;
                return (
                  <li key={lesson.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <Link href={`/courses/${course.id}/${lesson.id}`} className="text-stone-800 hover:text-indigo-600">
                      {lesson.title}
                    </Link>
                    <span className={p?.completedAt ? "text-emerald-700" : "text-stone-500"}>
                      {p?.completedAt ? "Completed" : `${done}/${activities.length} activities`}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
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
