"use client";

import { LessonPlayer } from "@/components/LessonPlayer";
import { useStudio } from "./StudioContext";

export function CoursePreviewPanel() {
  const { previewIndex, selected, setPreviewIndex } = useStudio();

  if (!selected) return null;

  return (
    <section>
      <p className="mb-3 rounded bg-amber-50 p-3">
        Preview uses your saved course. Student records are not changed.
      </p>
      <select
        className="rounded border p-2"
        value={previewIndex}
        onChange={(event) => setPreviewIndex(Number(event.target.value))}
      >
        {selected.document.lessons.map((lesson, index) => (
          <option value={index} key={lesson.id}>
            {lesson.title}
          </option>
        ))}
      </select>
      {selected.document.lessons[previewIndex] && (
        <LessonPlayer
          key={`${selected.revision}-${previewIndex}`}
          course={selected.document}
          lesson={selected.document.lessons[previewIndex]}
          preview
        />
      )}
    </section>
  );
}
