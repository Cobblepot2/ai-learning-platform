"use client";

import { ActivityEditor } from "@/components/learning/ActivityEditor";
import {
  buttonSecondary as secondary,
} from "@/components/blocks/BlockCard";
import {
  activityDefinitions,
  type ActivityType,
} from "@/lib/learning/registry";
import type { CourseDocument } from "@/lib/learning/model";
import { useStudio } from "./StudioContext";

export function LessonEditor({
  document,
  index,
}: {
  document: CourseDocument;
  index: number;
}) {
  const {
    addActivity,
    busy,
    instruction,
    moveActivity,
    moveLesson,
    proposeRevision,
    removeActivity,
    removeLesson,
    replaceActivityType,
    run,
    setInstruction,
    updateBlock,
    updateLesson,
  } = useStudio();
  const lesson = document.lessons[index];

  return (
    <section className="space-y-4 rounded-2xl border bg-white p-5">
      <div className="flex gap-3">
        <h2 className="flex-1 text-xl font-semibold">Lesson {index + 1}</h2>
        <button
          aria-label="Move lesson up"
          onClick={() => moveLesson(index, -1)}
        >
          ↑
        </button>
        <button
          aria-label="Move lesson down"
          onClick={() => moveLesson(index, 1)}
        >
          ↓
        </button>
        <button className="text-red-700" onClick={() => removeLesson(index)}>
          Remove
        </button>
      </div>
      <label className="block text-sm">
        Lesson title
        <input
          className="mt-1 w-full rounded border p-2"
          value={lesson.title}
          onChange={(event) =>
            updateLesson(index, { title: event.target.value })
          }
        />
      </label>
      <label className="block text-sm">
        Summary
        <textarea
          className="mt-1 w-full rounded border p-2"
          value={lesson.summary}
          onChange={(event) =>
            updateLesson(index, { summary: event.target.value })
          }
        />
      </label>
      <label className="block text-sm">
        Objectives (one per line)
        <textarea
          className="mt-1 w-full rounded border p-2"
          value={lesson.objectives.join("\n")}
          onChange={(event) =>
            updateLesson(index, {
              objectives: event.target.value.split("\n").filter(Boolean),
            })
          }
        />
      </label>
      <label className="block text-sm">
        Minutes
        <input
          type="number"
          min="1"
          className="ml-2 rounded border p-2"
          value={lesson.minutes}
          onChange={(event) =>
            updateLesson(index, { minutes: Number(event.target.value) })
          }
        />
      </label>
      {lesson.blocks.map((block, blockIndex) => (
        <details
          open
          className="rounded-xl border bg-stone-50 p-4"
          key={block.id}
        >
          <summary className="font-semibold">
            {blockIndex + 1}.{" "}
            {activityDefinitions[block.activityType].label}
          </summary>
          <div className="my-3 flex flex-wrap gap-3">
            <button onClick={() => moveActivity(index, blockIndex, -1)}>
              ↑ Move up
            </button>
            <button onClick={() => moveActivity(index, blockIndex, 1)}>
              ↓ Move down
            </button>
            <button
              className="text-red-700"
              onClick={() => removeActivity(index, blockIndex)}
            >
              Remove activity
            </button>
            <select
              aria-label="Replace activity type"
              value={block.activityType}
              onChange={(event) =>
                replaceActivityType(
                  index,
                  blockIndex,
                  event.target.value as ActivityType,
                )
              }
            >
              {Object.entries(activityDefinitions).map(([key, value]) => (
                <option value={key} key={key}>
                  {value.label}
                </option>
              ))}
            </select>
          </div>
          <ActivityEditor
            activity={block}
            onChange={(activity) => updateBlock(index, blockIndex, activity)}
          />
          <label className="mt-4 block text-sm">
            AI revision request
            <input
              className="mt-1 w-full rounded border p-2"
              value={instruction}
              onChange={(event) => setInstruction(event.target.value)}
              placeholder="E.g. simplify the language or change to a negotiation scenario"
            />
          </label>
          <button
            disabled={busy || !instruction.trim()}
            className={`${secondary} mt-2`}
            onClick={() =>
              run(async () => proposeRevision(index, blockIndex, block))
            }
          >
            Propose AI revision
          </button>
        </details>
      ))}
      <div className="flex flex-wrap gap-2">
        {Object.keys(activityDefinitions).map((type) => (
          <button
            key={type}
            className={secondary}
            onClick={() => addActivity(index, type as ActivityType)}
          >
            + {activityDefinitions[type as ActivityType].label}
          </button>
        ))}
      </div>
    </section>
  );
}
