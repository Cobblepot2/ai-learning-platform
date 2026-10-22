"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { buttonPrimary, buttonSecondary } from "@/components/blocks/BlockCard";
import {
  CourseStatusBadge,
  VisibilityLabel,
} from "@/components/teaching/CourseStatusBadge";
import type { CourseRecord } from "@/lib/learning/model";

type Visibility = CourseRecord["visibility"];

const visibilityHelp: Record<Visibility, string> = {
  private: "Only you can open the course. Useful while the draft is in progress.",
  enrolled:
    "Students can open the course after you invite them and they join from My courses.",
  public: "Anyone with the course link can open the published course.",
};

export function CourseSettings({ course }: { course: CourseRecord }) {
  const router = useRouter();
  const [visibility, setVisibility] = useState<Visibility>(course.visibility);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setVisibility(course.visibility);
  }, [course.visibility, course.revision]);

  async function update(
    status: CourseRecord["status"],
    nextVisibility: Visibility,
    successMessage: string,
  ) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/courses", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document: course.document,
          revision: course.revision,
          status,
          visibility: nextVisibility,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMessage(successMessage);
      router.refresh();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteDraft() {
    if (
      !confirm(
        "Delete this draft permanently? Drafts with learner records cannot be deleted; archive those instead.",
      )
    )
      return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/courses?id=${course.id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      router.push("/teach/courses");
      router.refresh();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {(message || error) && (
        <p
          role={error ? "alert" : "status"}
          className={`rounded-xl border p-4 text-sm ${
            error
              ? "border-rose-200 bg-rose-50 text-rose-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {error || message}
        </p>
      )}

      <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-stone-900">Publishing</h2>
        <p className="mt-1 text-sm text-stone-500">
          Current state: <CourseStatusBadge status={course.status} /> from
          revision {course.revision}.
        </p>

        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <div>
            <label
              htmlFor="course-visibility"
              className="text-sm font-medium text-stone-800"
            >
              Course access
            </label>
            <select
              id="course-visibility"
              value={visibility}
              onChange={(event) =>
                setVisibility(event.target.value as Visibility)
              }
              disabled={busy || course.status === "archived"}
              className="mt-2 w-full rounded-lg border border-stone-300 bg-white p-2.5 text-sm disabled:bg-stone-100"
            >
              <option value="enrolled">Invited students</option>
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
            <p className="mt-2 text-sm text-stone-500">
              {visibilityHelp[visibility]}
            </p>
          </div>

          <div className="rounded-xl bg-stone-50 p-4 text-sm text-stone-600">
            <p className="font-medium text-stone-800">Before publishing</p>
            <ul className="mt-2 list-inside list-disc space-y-1">
              <li>Every lesson needs at least one activity.</li>
              <li>Students only see the saved revision.</li>
              <li>Published courses stay visible until unpublished or archived.</li>
            </ul>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy || course.status === "archived"}
            className={buttonSecondary}
            onClick={() =>
              update(course.status, visibility, "Access settings saved.")
            }
          >
            Save access settings
          </button>
          <button
            type="button"
            disabled={busy}
            className={buttonPrimary}
            onClick={() => {
              if (
                !confirm(
                  "Publish this reviewed course with the selected access setting?",
                )
              )
                return;
              void update(
                "published",
                visibility,
                "Course published. Students with access can now open it.",
              );
            }}
          >
            {course.status === "published"
              ? "Update published course"
              : course.status === "archived"
                ? "Publish again"
                : "Publish course"}
          </button>
          {course.status === "published" && (
            <button
              type="button"
              disabled={busy}
              className={buttonSecondary}
              onClick={() =>
                void update(
                  "draft",
                  "private",
                  "Course unpublished and returned to a private draft.",
                )
              }
            >
              Unpublish
            </button>
          )}
          {course.status !== "archived" && (
            <button
              type="button"
              disabled={busy}
              className={buttonSecondary}
              onClick={() => {
                if (
                  !confirm(
                    "Archive this course? Learners keep their records, and it leaves the catalogue.",
                  )
                )
                  return;
                void update(
                  "archived",
                  "private",
                  "Course archived. Learner records are unchanged.",
                );
              }}
            >
              Archive
            </button>
          )}
        </div>
        <p className="mt-3 text-xs text-stone-500">
          Current access: <VisibilityLabel visibility={course.visibility} />.
          Changing access takes effect on the next save.
        </p>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-stone-900">Run the course</h2>
        <p className="mt-1 text-sm text-stone-600">
          Preview the saved revision, review student evidence, or invite the
          next group.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href={`/teach/courses/${course.id}/preview`}
            className={buttonSecondary}
          >
            Student preview
          </Link>
          <Link
            href={`/teach/courses/${course.id}/students`}
            className={buttonSecondary}
          >
            Students & invitations
          </Link>
          <Link
            href={`/teach/courses/${course.id}/curriculum`}
            className={buttonSecondary}
          >
            Edit curriculum
          </Link>
        </div>
      </section>

      {course.status === "draft" && (
        <section className="rounded-2xl border border-rose-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-stone-900">Danger zone</h2>
          <p className="mt-1 text-sm text-stone-600">
            Deleting removes the draft permanently. Courses with learner records
            must be archived instead.
          </p>
          <button
            type="button"
            disabled={busy}
            className="mt-4 text-sm font-medium text-rose-700 underline underline-offset-2 disabled:opacity-50"
            onClick={() => void deleteDraft()}
          >
            Delete draft
          </button>
        </section>
      )}
    </div>
  );
}
