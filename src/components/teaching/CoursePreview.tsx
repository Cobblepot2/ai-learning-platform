"use client";

import { useState } from "react";
import Link from "next/link";
import { LessonPlayer } from "@/components/LessonPlayer";
import { buttonSecondary } from "@/components/blocks/BlockCard";
import type { CourseRecord } from "@/lib/learning/model";

export function CoursePreview({ course }: { course: CourseRecord }) {
  const [index, setIndex] = useState(0);
  const document = course.document;
  const lesson = document.lessons[index];

  if (!lesson) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 lg:px-8">
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <h2 className="text-lg font-semibold text-stone-900">
            Nothing to preview yet
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-stone-600">
            Add at least one lesson in the curriculum editor, then come back to
            walk through it as a student.
          </p>
          <Link
            href={`/teach/courses/${course.id}/curriculum`}
            className={`${buttonSecondary} mt-5`}
          >
            Open curriculum
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mx-auto max-w-6xl space-y-4 px-4 pt-6 lg:px-8">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Preview uses the saved course at revision {course.revision}. Your
          responses are not saved to learner records.
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label
            htmlFor="preview-lesson"
            className="text-sm font-medium text-stone-700"
          >
            Lesson
          </label>
          <select
            id="preview-lesson"
            className="rounded-lg border border-stone-300 bg-white p-2 text-sm"
            value={index}
            onChange={(event) => setIndex(Number(event.target.value))}
          >
            {document.lessons.map((item, lessonIndex) => (
              <option value={lessonIndex} key={item.id}>
                {lessonIndex + 1}. {item.title}
              </option>
            ))}
          </select>
          <span className="text-sm text-stone-500">
            {index + 1} of {document.lessons.length}
          </span>
        </div>
      </div>

      <LessonPlayer
        key={`${course.revision}-${lesson.id}`}
        course={document}
        lesson={lesson}
        preview
      />
    </div>
  );
}
