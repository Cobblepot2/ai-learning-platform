"use client";

import {
  buttonPrimary as primary,
  buttonSecondary as secondary,
} from "@/components/blocks/BlockCard";
import type { CourseRecord } from "@/lib/learning/model";
import { useStudio } from "./StudioContext";

export function CourseActionBar() {
  const {
    busy,
    deleteDraft,
    dirty,
    run,
    save,
    scoped,
    selected,
    setVisibility,
    teacher,
    visibility,
  } = useStudio();

  if (!selected) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-white p-4">
      <button
        disabled={busy}
        className={primary}
        onClick={() => run(async () => void (await save()))}
      >
        Save {selected.status === "draft" ? "draft" : "changes"}
      </button>
      <span className="text-sm text-stone-500">
        {dirty ? "Unsaved changes" : `Saved revision ${selected.revision}`}
      </span>
      {scoped && (
        <span className="text-sm text-stone-500">
          Publishing, access and archive are managed in Settings.
        </span>
      )}
      {teacher && !scoped && (
        <>
          <select
            aria-label="Course access"
            value={visibility}
            onChange={(event) =>
              setVisibility(event.target.value as CourseRecord["visibility"])
            }
            className="rounded border p-2"
          >
            <option value="enrolled">Invited students</option>
            <option value="public">Public</option>
            <option value="private">Private</option>
          </select>
          <button
            disabled={busy}
            className={secondary}
            onClick={() =>
              run(async () => {
                if (
                  confirm(
                    "Publish this reviewed course with the selected access setting?",
                  )
                )
                  await save("published", visibility);
              })
            }
          >
            Publish reviewed course
          </button>
          {selected.status === "published" && (
            <button
              disabled={busy}
              className={secondary}
              onClick={() => run(async () => void (await save("draft", "private")))}
            >
              Unpublish
            </button>
          )}
        </>
      )}
      {teacher && !scoped && selected.status !== "archived" && (
        <button
          disabled={busy}
          className={secondary}
          onClick={() =>
            run(async () => {
              if (
                !confirm(
                  "Archive this course? Learners keep their records, and it leaves the catalogue.",
                )
              )
                return;
              await save("archived", "private");
            })
          }
        >
          Archive
        </button>
      )}
      {!scoped && selected.status === "draft" && (
        <button
          disabled={busy}
          className="text-sm text-red-700"
          onClick={() => run(deleteDraft)}
        >
          Delete draft
        </button>
      )}
    </div>
  );
}
