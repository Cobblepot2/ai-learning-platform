"use client";

import {
  buttonPrimary as primary,
  buttonSecondary as secondary,
} from "@/components/blocks/BlockCard";
import { useStudio } from "./StudioContext";
import type { StudioTab } from "./useCourseStudio";

const labels: Record<StudioTab, string> = {
  edit: "Edit course",
  ai: "AI builder",
  preview: "Student preview",
  students: "Students & results",
};

export function StudioTabs() {
  const {
    busy,
    dirty,
    scoped,
    setMessage,
    setPreviewIndex,
    setTab,
    tab,
    teacher,
  } = useStudio();

  const tabs: StudioTab[] = [
    "edit",
    "ai",
    ...(!scoped ? (["preview"] as StudioTab[]) : []),
    ...(!scoped && teacher ? (["students"] as StudioTab[]) : []),
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((value) => (
        <button
          key={value}
          className={tab === value ? primary : secondary}
          disabled={busy}
          onClick={() => {
            if (value === "preview" && dirty) {
              setMessage("Save changes before preview so AI uses the same content.");
              return;
            }
            setTab(value);
            setPreviewIndex(0);
          }}
        >
          {labels[value]}
        </button>
      ))}
    </div>
  );
}
