"use client";

import Link from "next/link";
import { ActivityView } from "@/components/learning/ActivityView";
import { useState } from "react";
import { TutorPanel } from "@/components/TutorPanel";
import { buttonPrimary } from "@/components/blocks/BlockCard";
import { isDatabaseCourseId } from "@/lib/learning/ids";
import { mergeBlockResult } from "@/lib/learner-progress";
import { useLearner } from "@/lib/learner-store";
import type { BlockResult, Course, Lesson, LessonBlock } from "@/lib/types";

export function LessonPlayer({ course, lesson, preview = false }: { course: Course; lesson: Lesson; preview?: boolean }) {
  const [previewResults, setPreviewResults] = useState<Record<string, BlockResult>>({});
  const [completionError, setCompletionError] = useState("");
  const [completing, setCompleting] = useState(false);
  const { ready, progress, recordBlock, completeLesson, noteServerLessonComplete } = useLearner();
  const [tutorOpen, setTutorOpen] = useState(false);
  const lessonProgress = progress[`${course.id}/${lesson.id}`];
  const results = preview ? previewResults : lessonProgress?.blocks ?? {};

  const activities = lesson.blocks.filter(
    (block) => !(block.type === "activity" && block.activityType === "reading"),
  );
  const doneCount = activities.filter((b) => results[b.id]?.done).length;
  const allDone = doneCount === activities.length;
  const lessonIsComplete = !preview && !!lessonProgress?.completedAt && allDone;

  const index = course.lessons.findIndex((l) => l.id === lesson.id);
  const next = course.lessons[index + 1];

  function render(block: LessonBlock) {
    return (
      <ActivityView
        block={block}
        courseId={course.id}
        lessonId={lesson.id}
        preview={preview}
        result={results[block.id]}
        onResult={(result: BlockResult) =>
          preview
            ? setPreviewResults((prev) => ({
                ...prev,
                [block.id]: mergeBlockResult(prev[block.id], result),
              }))
            : recordBlock(course.id, lesson.id, block.id, result)
        }
      />
    );
  }

  if (!ready) return <p role="status" className="mx-auto max-w-6xl px-4 py-8">Loading your progress…</p>;

  return (
    <div className="mx-auto flex max-w-6xl gap-6 px-4 py-8">
      <div className="min-w-0 flex-1">
        <nav className="text-sm text-stone-500">
          <Link href={`/courses/${course.id}`} className="hover:text-indigo-600">
            {course.title}
          </Link>
          <span className="mx-2">/</span>
          <span>Lesson {index + 1}</span>
        </nav>
        <h1 className="mt-2 text-3xl font-bold text-stone-900">{lesson.title}</h1>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-1.5 w-40 overflow-hidden rounded-full bg-stone-200">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all"
              style={{ width: `${activities.length ? (doneCount / activities.length) * 100 : 100}%` }}
            />
          </div>
          <span className="text-xs text-stone-500">
            {doneCount} / {activities.length} activities
          </span>
        </div>

        <div className="mt-8 space-y-8">
          {lesson.blocks.map((b) => (
            <div key={b.id}>{render(b)}</div>
          ))}
        </div>

        {completionError && <p role="alert" className="text-red-700">{completionError}</p>}
        <div className="mt-10 flex flex-wrap items-center gap-4 rounded-2xl border border-stone-200 bg-white p-5">
          {lessonIsComplete ? (
            <p className="flex-1 font-medium text-emerald-700">Lesson complete ✓</p>
          ) : (
            <p className="flex-1 text-sm text-stone-600">
              {allDone ? "Nice work, every activity is done." : "Finish the activities above to complete this lesson."}
            </p>
          )}
          {!lessonIsComplete && (
            <button type="button" className={buttonPrimary} disabled={!allDone || completing || preview} onClick={async () => {
              if (preview) return;
              setCompleting(true); setCompletionError("");
              try {
                if (isDatabaseCourseId(course.id)) {
                  const res = await fetch("/api/activities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ courseId: course.id, lessonId: lesson.id, action: "complete" }) });
                  const data = await res.json(); if (!res.ok) throw new Error(data.error);
                  noteServerLessonComplete(course.id, lesson.id);
                } else {
                  await completeLesson(course.id, lesson.id);
                }
              } catch(e) { setCompletionError((e as Error).message); } finally { setCompleting(false); }
            }}>
              Mark lesson complete
            </button>
          )}
          {lessonIsComplete &&
            (next ? (
              <Link href={`/courses/${course.id}/${next.id}`} className={buttonPrimary}>
                Next: {next.title} →
              </Link>
            ) : (
              <Link href="/dashboard" className={buttonPrimary}>
                View my progress →
              </Link>
            ))}
        </div>
      </div>

      {/* Desktop: sticky side panel. Mobile: floating button + bottom sheet. */}
      <aside className="sticky top-20 hidden h-[calc(100vh-6rem)] w-80 shrink-0 overflow-hidden rounded-2xl border border-stone-200 bg-stone-50 lg:block">
        <TutorPanel courseId={course.id} lessonId={lesson.id} />
      </aside>
      <button
        type="button"
        onClick={() => setTutorOpen(true)}
        className="fixed bottom-5 right-5 z-30 rounded-full bg-indigo-600 px-5 py-3 text-sm font-medium text-white shadow-lg lg:hidden"
      >
        Ask AI tutor
      </button>
      {tutorOpen && (
        <div className="fixed inset-0 z-40 flex flex-col bg-black/30 lg:hidden" onClick={() => setTutorOpen(false)}>
          <div className="mt-auto h-[80vh] rounded-t-2xl bg-stone-50" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end px-3 pt-2">
              <button type="button" onClick={() => setTutorOpen(false)} className="px-2 text-2xl text-stone-500" aria-label="Close tutor">
                ×
              </button>
            </div>
            <div className="h-[calc(80vh-2.5rem)]">
              <TutorPanel courseId={course.id} lessonId={lesson.id} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
