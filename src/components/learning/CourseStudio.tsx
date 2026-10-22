"use client";

import Link from "next/link";
import { Analytics } from "./Analytics";
import { AIBuilderPanel } from "./studio/AIBuilderPanel";
import { CourseActionBar } from "./studio/CourseActionBar";
import { CourseEditorPanel } from "./studio/CourseEditorPanel";
import { CoursePickerSidebar } from "./studio/CoursePickerSidebar";
import { CoursePreviewPanel } from "./studio/CoursePreviewPanel";
import { StudioProvider } from "./studio/StudioContext";
import { StudioTabs } from "./studio/StudioTabs";
import { useCourseStudio, type StudioOptions } from "./studio/useCourseStudio";
import { exampleCourse } from "@/lib/learning/examples";
import { newCourse } from "@/lib/learning/model";
import {
  buttonPrimary as primary,
  buttonSecondary as secondary,
} from "@/components/blocks/BlockCard";

export function CourseStudio(options: StudioOptions) {
  const studio = useCourseStudio(options);
  const {
    account,
    busy,
    createCourse,
    document,
    joinInvited,
    message,
    run,
    scoped,
    selected,
    tab,
    teacher,
  } = studio;

  return (
    <StudioProvider value={studio}>
      <div
        className={
          scoped ? "space-y-5" : "mx-auto max-w-6xl space-y-6 px-4 py-8"
        }
      >
        {!scoped && (
          <>
            <h1 className="text-3xl font-bold">
              {teacher
                ? "Teaching studio"
                : "My private courses & learning path"}
            </h1>
            <p className="text-stone-600">
              {teacher
                ? "Design learning in any subject. Choose activities, review AI suggestions, then publish."
                : "Create a mini-course in any subject. Order lessons into your personal learning path. Your courses stay private."}
            </p>
          </>
        )}
        {message && (
          <p
            role="status"
            className="whitespace-pre-wrap rounded-xl border border-indigo-200 bg-indigo-50 p-4"
          >
            {message}
          </p>
        )}
        {!account ? (
          <Link href="/login" className={primary}>
            Sign in to continue
          </Link>
        ) : teacher && !account.isTeacher ? (
          <p role="alert">
            Instructor access required. An administrator must assign your role.{" "}
            <Link className="underline" href="/my-courses">
              Create a private course instead
            </Link>
            .
          </p>
        ) : (
          <>
            {!scoped && (
              <div className="flex flex-wrap gap-3">
                <button
                  disabled={busy}
                  className={primary}
                  onClick={() =>
                    run(async () => createCourse(newCourse()))
                  }
                >
                  Create course
                </button>
                <button
                  disabled={busy}
                  className={secondary}
                  onClick={() => run(joinInvited)}
                >
                  Join invited courses
                </button>
                <Link className={secondary} href="/#courses">
                  Browse available courses
                </Link>
                {(["software", "english"] as const).map((subject) => (
                  <button
                    disabled={busy}
                    className={secondary}
                    key={subject}
                    onClick={() =>
                      run(async () => createCourse(exampleCourse(subject)))
                    }
                  >
                    Start{" "}
                    {subject === "software"
                      ? "Software Engineering"
                      : "English"}{" "}
                    example
                  </button>
                ))}
              </div>
            )}
            <div
              className={
                scoped ? "space-y-5" : "grid gap-6 lg:grid-cols-[240px_1fr]"
              }
            >
              {!scoped && <CoursePickerSidebar />}
              {document && selected && (
                <div className="min-w-0 space-y-5">
                  <StudioTabs />
                  <CourseActionBar />
                  {tab === "edit" && (
                    <CourseEditorPanel document={document} />
                  )}
                  {tab === "ai" && <AIBuilderPanel document={document} />}
                  {tab === "preview" && <CoursePreviewPanel />}
                  {tab === "students" && teacher && (
                    <Analytics key={selected.id} courseId={selected.id} />
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </StudioProvider>
  );
}
