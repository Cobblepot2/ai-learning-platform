"use client";

import { useState } from "react";
import { DraftReview } from "@/components/learning/DraftReview";
import { ActivitySummary } from "@/components/learning/ActivitySummary";
import { SimulationView } from "@/components/learning/SimulationView";
import {
  buttonPrimary as primary,
  buttonSecondary as secondary,
} from "@/components/blocks/BlockCard";
import {
  activityDefinitions,
  validateActivity,
  type ActivityType,
} from "@/lib/learning/registry";
import type { CourseDocument } from "@/lib/learning/model";
import { useStudio } from "./StudioContext";
import { move } from "./useCourseStudio";

export function AIBuilderPanel({ document }: { document: CourseDocument }) {
  const {
    acceptLesson,
    acceptRemaining,
    acceptSimulation,
    blockReason,
    busy,
    candidate,
    designSimulation,
    generate,
    generateOutline,
    goals,
    hiddenLessons,
    outline,
    rejectAll,
    rejectLesson,
    rejectSimulation,
    run,
    selected,
    setCandidate,
    setGoals,
    setOutline,
    simulationProposal,
  } = useStudio();
  const [design, setDesign] = useState({
    topic: document.domain,
    objectives: document.objectives.join("\n"),
    audience: document.targetAudience || goals.audience,
    difficulty: document.level,
    interactionStyle: "",
    requirements: "",
    language: document.language || goals.language,
  });
  const [designLesson, setDesignLesson] = useState(0);
  const [showSimulationPreview, setShowSimulationPreview] = useState(false);
  const proposed = simulationProposal
    ? validateActivity(simulationProposal.activity)
    : null;
  const previewSimulation =
    proposed?.success && proposed.data.activityType === "simulation"
      ? proposed.data
      : null;

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

      <div className="space-y-3 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4">
        <div>
          <h2 className="text-lg font-semibold">Design a decision simulation</h2>
          <p className="text-sm text-stone-600">
            AI proposes a stateful scenario using the platform&apos;s declarative rules. It
            is checked against the schema and only inserted after you accept it. Not every
            objective needs a simulation; the designer will say so when a simpler
            activity fits better.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block text-sm">
            Topic
            <input
              className="mt-1 w-full rounded border p-2"
              value={design.topic}
              onChange={(event) => setDesign({ ...design, topic: event.target.value })}
            />
          </label>
          <label className="block text-sm">
            Audience
            <input
              className="mt-1 w-full rounded border p-2"
              value={design.audience}
              onChange={(event) => setDesign({ ...design, audience: event.target.value })}
            />
          </label>
          <label className="block text-sm">
            Difficulty
            <input
              className="mt-1 w-full rounded border p-2"
              value={design.difficulty}
              onChange={(event) =>
                setDesign({ ...design, difficulty: event.target.value })
              }
            />
          </label>
          <label className="block text-sm">
            Interaction style (optional)
            <input
              className="mt-1 w-full rounded border p-2"
              value={design.interactionStyle}
              placeholder="e.g. tense negotiation, incident triage"
              onChange={(event) =>
                setDesign({ ...design, interactionStyle: event.target.value })
              }
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            Objectives
            <textarea
              className="mt-1 min-h-20 w-full rounded border p-2"
              value={design.objectives}
              onChange={(event) =>
                setDesign({ ...design, objectives: event.target.value })
              }
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            Constraints or requirements (optional)
            <textarea
              className="mt-1 min-h-16 w-full rounded border p-2"
              value={design.requirements}
              onChange={(event) =>
                setDesign({ ...design, requirements: event.target.value })
              }
            />
          </label>
          <label className="block text-sm">
            Language
            <input
              className="mt-1 w-full rounded border p-2"
              value={design.language}
              onChange={(event) => setDesign({ ...design, language: event.target.value })}
            />
          </label>
          <label className="block text-sm">
            Add to lesson
            <select
              className="mt-1 w-full rounded border p-2"
              value={designLesson}
              onChange={(event) => setDesignLesson(Number(event.target.value))}
            >
              {document.lessons.map((lesson, index) => (
                <option key={lesson.id} value={index}>
                  {index + 1}. {lesson.title}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            className={secondary}
            disabled={busy || !document.lessons.length}
            onClick={() =>
              run(async () => {
                await designSimulation(designLesson, {
                  ...design,
                  interactionStyle: design.interactionStyle || undefined,
                  requirements: design.requirements || undefined,
                });
                setShowSimulationPreview(false);
              })
            }
          >
            {busy ? "Designing…" : "Generate simulation"}
          </button>
          <button
            type="button"
            className="text-sm text-indigo-700 underline"
            onClick={() =>
              setDesign({
                topic: document.domain,
                objectives: document.objectives.join("\n"),
                audience: document.targetAudience || goals.audience,
                difficulty: document.level,
                interactionStyle: design.interactionStyle,
                requirements: design.requirements,
                language: document.language || goals.language,
              })
            }
          >
            Use current course goals
          </button>
        </div>
        {!document.lessons.length && (
          <p className="text-sm text-amber-800">
            Add a lesson in the editor before designing an activity.
          </p>
        )}
        {simulationProposal && previewSimulation && (
          <div className="space-y-3 rounded-xl border border-indigo-300 bg-white p-3">
            <p className="text-sm text-stone-600">
              {simulationProposal.reason}
            </p>
            <ActivitySummary activity={simulationProposal.activity} />
            <button
              type="button"
              className="text-sm text-indigo-700 underline"
              onClick={() => setShowSimulationPreview((open) => !open)}
            >
              {showSimulationPreview ? "Hide test play" : "Test-play the full flow"}
            </button>
            {showSimulationPreview && (
              <div className="rounded-xl bg-stone-50 p-3">
                <SimulationView
                  key={previewSimulation.id}
                  block={previewSimulation}
                  courseId={selected?.id ?? "studio-preview"}
                  lessonId={document.lessons[simulationProposal.lesson]?.id ?? "preview"}
                  preview
                  onResult={() => undefined}
                />
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <button
                className={primary}
                disabled={busy}
                onClick={acceptSimulation}
              >
                Accept into lesson
              </button>
              <button
                className={secondary}
                disabled={busy}
                onClick={rejectSimulation}
              >
                Reject
              </button>
            </div>
          </div>
        )}
      </div>
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
