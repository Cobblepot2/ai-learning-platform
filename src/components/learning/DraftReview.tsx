"use client";
import type { CourseDocument } from "@/lib/learning/model";
import { buttonPrimary, buttonSecondary } from "@/components/blocks/BlockCard";
import { ActivitySummary } from "./ActivitySummary";

function LessonCard({
  heading,
  lesson,
}: {
  heading: string;
  lesson?: CourseDocument["lessons"][number];
}) {
  if (!lesson) {
    return (
      <div className="rounded border border-dashed p-3 text-sm text-stone-500">
        <p className="font-semibold text-stone-700">{heading}</p>
        <p>No lesson at this position.</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{heading}</p>
        <h3 className="text-lg font-semibold">{lesson.title}</h3>
        <p className="text-sm text-stone-600">
          {lesson.minutes} min · {lesson.blocks.length} activities
        </p>
        {lesson.summary && <p className="mt-1 whitespace-pre-wrap text-sm">{lesson.summary}</p>}
        {!!lesson.objectives.length && (
          <ul className="mt-2 list-inside list-disc text-sm text-stone-700">
            {lesson.objectives.map((objective) => (
              <li key={objective}>{objective}</li>
            ))}
          </ul>
        )}
      </div>
      {lesson.blocks.map((block, index) => (
        <ActivitySummary key={block.id} title={`Activity ${index + 1}`} activity={block} />
      ))}
    </div>
  );
}

export function DraftReview({
  current,
  proposal,
  hidden,
  blockedReason,
  busy,
  onAcceptLesson,
  onRejectLesson,
  onAcceptAll,
  onRejectAll,
}: {
  current: CourseDocument;
  proposal: CourseDocument;
  hidden: number[];
  blockedReason: string | null;
  busy: boolean;
  onAcceptLesson: (index: number) => void;
  onRejectLesson: (index: number) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
}) {
  const visible = proposal.lessons
    .map((lesson, index) => ({ lesson, index }))
    .filter((item) => !hidden.includes(item.index));
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">3. Review generated content</h2>
      <p className="text-sm text-stone-600">
        Current course: {current.lessons.length} lesson(s). Proposal: {proposal.lessons.length}{" "}
        lesson(s). Accepting keeps the course id and, at the same position, the existing lesson
        and activity ids. New positions keep the generated ids. Nothing is saved until you save
        the draft.
      </p>
      {hidden.length === 0 &&
        proposal.lessons.length < current.lessons.length &&
        !blockedReason && (
          <p className="text-sm text-amber-800">
            Accepting every remaining lesson replaces the lesson list. Editor lessons after
            position {proposal.lessons.length} are removed. Reject the proposal if those lessons
            should stay.
          </p>
        )}
      {blockedReason && (
        <p role="alert" className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">
          {blockedReason}
        </p>
      )}
      {proposal.title !== current.title && (
        <p className="text-sm">
          Proposed title: <strong>{proposal.title}</strong> · domain {proposal.domain}
        </p>
      )}
      {visible.map(({ lesson, index }) => (
        <article key={lesson.id} className="space-y-3 rounded-xl border bg-white p-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <LessonCard heading="Current" lesson={current.lessons[index]} />
            <LessonCard heading="Proposed" lesson={lesson} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className={buttonPrimary}
              disabled={busy}
              onClick={() => onAcceptLesson(index)}
            >
              Accept lesson {index + 1}
            </button>
            <button
              className={buttonSecondary}
              disabled={busy}
              onClick={() => onRejectLesson(index)}
            >
              Reject lesson {index + 1}
            </button>
          </div>
        </article>
      ))}
      {!visible.length && <p className="text-sm text-stone-500">Every proposed lesson has been accepted or rejected.</p>}
      <div className="flex flex-wrap gap-2">
        <button className={buttonPrimary} disabled={busy || !!blockedReason || !visible.length} onClick={onAcceptAll}>
          Accept remaining lessons
        </button>
        <button className={buttonSecondary} disabled={busy} onClick={onRejectAll}>
          Reject proposal
        </button>
      </div>
    </section>
  );
}
