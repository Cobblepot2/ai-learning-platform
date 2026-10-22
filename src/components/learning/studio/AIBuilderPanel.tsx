"use client";

import { DraftReview } from "@/components/learning/DraftReview";
import {
  buttonPrimary as primary,
  buttonSecondary as secondary,
} from "@/components/blocks/BlockCard";
import { activityDefinitions, type ActivityType } from "@/lib/learning/registry";
import type { CourseDocument } from "@/lib/learning/model";
import { useStudio } from "./StudioContext";
import { move } from "./useCourseStudio";

export function AIBuilderPanel({ document }: { document: CourseDocument }) {
  const {
    acceptLesson,
    acceptRemaining,
    blockReason,
    busy,
    candidate,
    generate,
    generateOutline,
    goals,
    hiddenLessons,
    outline,
    rejectAll,
    rejectLesson,
    run,
    setCandidate,
    setGoals,
    setOutline,
  } = useStudio();

  return (
    <section className="space-y-5 rounded-2xl border bg-white p-5">
      <h2 className="text-xl font-semibold">1. Define learning goals</h2>
      {Object.entries(goals).map(([key, value]) => (
        <label className="block text-sm capitalize" key={key}>
          {key === "references"
            ? "Reference material (paste text; URLs are not fetched)"
            : key}
          <textarea
            className="mt-1 w-full rounded border p-2"
            value={value}
            onChange={(event) => {
              setGoals({ ...goals, [key]: event.target.value });
              setCandidate(null);
            }}
          />
        </label>
      ))}
      <button
        className={primary}
        disabled={busy}
        onClick={() => run(generateOutline)}
      >
        Generate outline
      </button>
      {outline && (
        <>
          <h2 className="text-xl font-semibold">2. Edit and approve outline</h2>
          <label className="block">
            Course title
            <input
              className="ml-2 rounded border p-2"
              value={outline.title}
              onChange={(event) =>
                setOutline({ ...outline, title: event.target.value })
              }
            />
          </label>
          {outline.lessons.map((lesson, index) => (
            <div key={index} className="space-y-2 rounded border p-3">
              <input
                aria-label={`Outline lesson ${index + 1} title`}
                className="w-full rounded border p-2"
                value={lesson.title}
                onChange={(event) =>
                  setOutline({
                    ...outline,
                    lessons: outline.lessons.map((value, lessonIndex) =>
                      index === lessonIndex
                        ? { ...value, title: event.target.value }
                        : value,
                    ),
                  })
                }
              />
              <textarea
                aria-label="Outline objectives"
                className="w-full rounded border p-2"
                value={lesson.objectives.join("\n")}
                onChange={(event) =>
                  setOutline({
                    ...outline,
                    lessons: outline.lessons.map((value, lessonIndex) =>
                      index === lessonIndex
                        ? {
                            ...value,
                            objectives: event.target.value.split("\n"),
                          }
                        : value,
                    ),
                  })
                }
              />
              <div className="flex flex-wrap gap-3">
                {Object.entries(activityDefinitions).map(([type, definition]) => (
                  <label className="text-sm" key={type}>
                    <input
                      type="checkbox"
                      checked={lesson.suggestedActivities.includes(
                        type as ActivityType,
                      )}
                      onChange={(event) =>
                        setOutline({
                          ...outline,
                          lessons: outline.lessons.map((value, lessonIndex) =>
                            lessonIndex === index
                              ? {
                                  ...value,
                                  suggestedActivities: event.target.checked
                                    ? [
                                        ...value.suggestedActivities,
                                        type as ActivityType,
                                      ]
                                    : value.suggestedActivities.filter(
                                        (activityType) => activityType !== type,
                                      ),
                                }
                              : value,
                          ),
                        })
                      }
                    />
                    {definition.label}
                  </label>
                ))}
              </div>
              <button
                onClick={() =>
                  setOutline({
                    ...outline,
                    lessons: move(outline.lessons, index, -1),
                  })
                }
              >
                ↑
              </button>
              <button
                className="ml-4"
                onClick={() =>
                  setOutline({
                    ...outline,
                    lessons: move(outline.lessons, index, 1),
                  })
                }
              >
                ↓
              </button>
              <button
                className="ml-4 text-red-700"
                onClick={() =>
                  setOutline({
                    ...outline,
                    lessons: outline.lessons.filter(
                      (_, lessonIndex) => lessonIndex !== index,
                    ),
                  })
                }
              >
                Remove
              </button>
            </div>
          ))}
          <button
            className={secondary}
            onClick={() =>
              setOutline({
                ...outline,
                lessons: [
                  ...outline.lessons,
                  {
                    title: "New lesson",
                    objectives: ["Learning goal"],
                    suggestedActivities: ["reading"],
                  },
                ],
              })
            }
          >
            + Outline lesson
          </button>
          {outline.limitations.length > 0 && (
            <ul className="list-inside list-disc text-amber-800">
              {outline.limitations.map((limitation, index) => (
                <li key={index}>{limitation}</li>
              ))}
            </ul>
          )}
          <button
            className={`${primary} ml-2`}
            disabled={busy}
            onClick={() => run(generate)}
          >
            Approve outline & generate content
          </button>
        </>
      )}
      {candidate && (
        <DraftReview
          current={document}
          proposal={candidate}
          hidden={hiddenLessons}
          blockedReason={
            candidate.lessons.length !== outline?.lessons.length
              ? "Generation is incomplete, so the whole proposal cannot be accepted."
              : blockReason
          }
          busy={busy}
          onAcceptLesson={acceptLesson}
          onRejectLesson={rejectLesson}
          onAcceptAll={acceptRemaining}
          onRejectAll={rejectAll}
        />
      )}
    </section>
  );
}
