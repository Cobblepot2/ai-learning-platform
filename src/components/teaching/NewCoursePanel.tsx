"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { exampleCourse } from "@/lib/learning/examples";
import { newCourse } from "@/lib/learning/model";

const options = [
  {
    key: "blank",
    title: "Start from scratch",
    description:
      "Create an empty draft, then add lessons by hand or use the AI builder to propose an outline.",
    action: "Create blank course",
  },
  {
    key: "english",
    title: "English communication example",
    description:
      "Start with a reviewed example course and adapt the lessons, activities and feedback prompts.",
    action: "Use English example",
  },
  {
    key: "software",
    title: "Software engineering example",
    description:
      "Start with a technical example covering reading, practice and code review activities.",
    action: "Use software example",
  },
] as const;

export function NewCoursePanel() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function create(kind: (typeof options)[number]["key"]) {
    setBusy(kind);
    setError("");
    try {
      const document =
        kind === "blank" ? newCourse() : exampleCourse(kind);
      const response = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(document),
      });
      const row = await response.json();
      if (!response.ok) throw new Error(row.error);
      router.push(`/teach/courses/${row.id}/curriculum`);
      router.refresh();
    } catch (cause) {
      setError((cause as Error).message);
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
        >
          {error}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {options.map((option) => (
          <section
            key={option.key}
            className="flex flex-col rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"
          >
            <h2 className="text-lg font-bold text-stone-900">{option.title}</h2>
            <p className="mt-2 flex-1 text-sm leading-6 text-stone-600">
              {option.description}
            </p>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => void create(option.key)}
              className="mt-5 inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === option.key ? "Creating…" : option.action}
            </button>
          </section>
        ))}
      </div>

      <p className="text-sm text-stone-500">
        Every new course starts as a private draft. Nothing is visible to
        students until you publish it from the course settings.
      </p>
    </div>
  );
}
