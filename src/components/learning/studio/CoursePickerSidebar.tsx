"use client";

import Link from "next/link";
import { useStudio } from "./StudioContext";

export function CoursePickerSidebar() {
  const { rows, select, selected } = useStudio();

  return (
    <aside className="space-y-2">
      {rows.map((row) => (
        <div
          key={row.id}
          className={`block w-full rounded-xl border p-4 text-left ${
            selected?.id === row.id
              ? "border-indigo-500 bg-indigo-50"
              : "bg-white"
          }`}
        >
          <button
            className="block text-left font-semibold"
            onClick={() => select(row)}
          >
            {row.document.title}
          </button>
          <span className="block text-sm text-stone-500">
            {row.document.domain} · {row.status} · {row.visibility}
          </span>
          <Link
            href={`/courses/${row.id}`}
            className="mt-2 block text-sm text-indigo-700"
            onClick={(event) => event.stopPropagation()}
          >
            Open course →
          </Link>
        </div>
      ))}
    </aside>
  );
}
