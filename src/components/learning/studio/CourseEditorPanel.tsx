"use client";

import { buttonSecondary as secondary } from "@/components/blocks/BlockCard";
import type { CourseDocument } from "@/lib/learning/model";
import { CourseMetaForm } from "./CourseMetaForm";
import { LessonEditor } from "./LessonEditor";
import { ProposalReview } from "./ProposalReview";
import { useStudio } from "./StudioContext";

export function CourseEditorPanel({ document }: { document: CourseDocument }) {
  const { addLesson } = useStudio();

  return (
    <div className="space-y-5">
      <CourseMetaForm document={document} />
      {document.lessons.map((lesson, index) => (
        <LessonEditor key={lesson.id} document={document} index={index} />
      ))}
      <button className={secondary} onClick={addLesson}>
        + Add lesson
      </button>
      <ProposalReview />
    </div>
  );
}
