"use client";

import type { CourseDocument } from "@/lib/learning/model";
import { useStudio } from "./StudioContext";

const fields = [
  "title",
  "domain",
  "targetAudience",
  "language",
  "level",
  "tagline",
] as const;

export function CourseMetaForm({ document }: { document: CourseDocument }) {
  const { updateDocument } = useStudio();

  return (
    <section className="grid gap-4 rounded-2xl border bg-white p-5 sm:grid-cols-2">
      {fields.map((key) => (
        <label className="text-sm capitalize" key={key}>
          {key}
          <input
            className="mt-1 w-full rounded border p-2"
            value={document[key]}
            onChange={(event) =>
              updateDocument({ [key]: event.target.value })
            }
          />
        </label>
      ))}
      <label className="text-sm sm:col-span-2">
        Description
        <textarea
          className="mt-1 w-full rounded border p-2"
          value={document.description}
          onChange={(event) =>
            updateDocument({ description: event.target.value })
          }
        />
      </label>
      {(["objectives", "prerequisites"] as const).map((key) => (
        <label className="text-sm capitalize" key={key}>
          {key} (one per line)
          <textarea
            className="mt-1 w-full rounded border p-2"
            value={document[key].join("\n")}
            onChange={(event) =>
              updateDocument({
                [key]: event.target.value.split("\n").filter(Boolean),
              })
            }
          />
        </label>
      ))}
      <label className="text-sm">
        Estimated duration (minutes)
        <input
          type="number"
          min="1"
          className="mt-1 w-full rounded border p-2"
          value={document.estimatedMinutes}
          onChange={(event) =>
            updateDocument({ estimatedMinutes: Number(event.target.value) })
          }
        />
      </label>
    </section>
  );
}
