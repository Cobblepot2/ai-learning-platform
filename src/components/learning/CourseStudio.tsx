"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { z } from "zod";
import {
  acceptProposalLesson,
  mergeCourseDraft,
  newCourse,
  parseCourse,
  outlineSchema,
  goalsSchema,
  type CourseDocument,
  type CourseRecord,
} from "@/lib/learning/model";
import {
  activityDefinitions,
  newActivity,
  type ActivityType,
  type LearningActivity,
} from "@/lib/learning/registry";
import { ActivityEditor } from "./ActivityEditor";
import { exampleCourse } from "@/lib/learning/examples";
import { Analytics } from "./Analytics";
import { ActivitySummary } from "./ActivitySummary";
import { DraftReview } from "./DraftReview";
import { LessonPlayer } from "@/components/LessonPlayer";
import {
  buttonPrimary as primary,
  buttonSecondary as secondary,
} from "@/components/blocks/BlockCard";

const initialGoals: z.infer<typeof goalsSchema> = {
  topic: "",
  audience: "",
  objectives: "",
  difficulty: "Beginner",
  requirements: "",
  references: "",
  length: "3 lessons, 30 minutes",
  language: "English",
};
async function request(url: string, method = "GET", body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}
function move<T>(array: T[], index: number, direction: number): T[] {
  const next = [...array],
    target = index + direction;
  if (target < 0 || target >= next.length) return array;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
export function CourseStudio({
  teacher = false,
  initialCourseId,
}: {
  teacher?: boolean;
  initialCourseId?: string;
}) {
  const [account, setAccount] = useState<{ isTeacher: boolean } | null>(null);
  const [rows, setRows] = useState<CourseRecord[]>([]);
  const [selected, setSelected] = useState<CourseRecord | null>(null);
  const [document, setDocument] = useState<CourseDocument | null>(null);
  const [goals, setGoals] = useState(initialGoals);
  const [outline, setOutline] = useState<z.infer<typeof outlineSchema> | null>(
    null,
  );
  const [candidate, setCandidate] = useState<CourseDocument | null>(null);
  const [hiddenLessons, setHiddenLessons] = useState<number[]>([]);
  const [impact, setImpact] = useState<{
    attempts: number;
    enrolments: number;
    progress: number;
  } | null>(null);
  const [proposal, setProposal] = useState<{
    lesson: number;
    block: number;
    before: LearningActivity;
    after: LearningActivity;
  } | null>(null);
  const [instruction, setInstruction] = useState("");
  const [tab, setTab] = useState<"edit" | "ai" | "preview" | "students">(
    "edit",
  );
  const [previewIndex, setPreviewIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [visibility, setVisibility] =
    useState<CourseRecord["visibility"]>("enrolled");
  const dirty =
    !!document &&
    !!selected &&
    JSON.stringify(document) !== JSON.stringify(selected.document);
  useEffect(() => {
    request("/api/me")
      .then((a) => {
        setAccount(a);
        return request("/api/courses");
      })
      .then((rows: CourseRecord[]) => {
        setRows(rows);
        if (!initialCourseId) return;
        const target = rows.find((row) => row.id === initialCourseId);
        if (!target) return;
        setSelected(target);
        setDocument(structuredClone(target.document));
        setVisibility(target.visibility);
        setOutline(null);
        setCandidate(null);
        setHiddenLessons([]);
        setProposal(null);
        setTab("edit");
        setGoals({
          ...initialGoals,
          topic: target.document.domain,
          audience: target.document.targetAudience,
          objectives: target.document.objectives.join("\n"),
          difficulty: target.document.level,
          language: target.document.language,
        });
      })
      .catch((e) => setMessage(e.message));
  }, [initialCourseId]);
  useEffect(() => {
    if (!selected) return;
    let active = true;
    setImpact(null);
    request(`/api/courses?learnerImpact=${selected.id}`)
      .then((data) => {
        if (active) setImpact(data);
      })
      .catch(() => {
        if (active) setImpact(null);
      });
    return () => {
      active = false;
    };
  }, [selected]);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await action();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function select(row: CourseRecord) {
    if (busy) return;
    if (dirty && !confirm("Discard unsaved changes?")) return;
    setSelected(row);
    setDocument(structuredClone(row.document));
    setVisibility(row.visibility);
    setOutline(null);
    setCandidate(null);
    setHiddenLessons([]);
    setProposal(null);
    setTab("edit");
    setGoals({
      ...initialGoals,
      topic: row.document.domain,
      audience: row.document.targetAudience,
      objectives: row.document.objectives.join("\n"),
      difficulty: row.document.level,
      language: row.document.language,
    });
  }
  async function save(
    status = selected?.status ?? "draft",
    nextVisibility = selected?.visibility ?? "private",
  ) {
    if (!document || !selected) return;
    const checked = parseCourse(document);
    const row = await request("/api/courses", "PUT", {
      document: checked,
      revision: selected.revision,
      status,
      visibility: nextVisibility,
    });
    setSelected(row);
    setDocument(structuredClone(row.document));
    setRows((prev) => prev.map((r) => (r.id === row.id ? row : r)));
    setMessage("Saved.");
    return row as CourseRecord;
  }
  function updateLesson(
    index: number,
    patch: Partial<CourseDocument["lessons"][number]>,
  ) {
    setDocument((prev) =>
      prev
        ? {
            ...prev,
            lessons: prev.lessons.map((l, i) =>
              i === index ? { ...l, ...patch } : l,
            ),
          }
        : prev,
    );
  }
  function updateBlock(li: number, bi: number, activity: LearningActivity) {
    if (!document) return;
    updateLesson(li, {
      blocks: document.lessons[li].blocks.map((b, i) =>
        i === bi ? activity : b,
      ),
    });
  }
  async function generate() {
    if (!outline || !document) return;
    const approved = outlineSchema.parse(outline);
    const checkedGoals = goalsSchema.parse(goals);
    setHiddenLessons([]);
    const next = {
      ...document,
      title: approved.title,
      domain: approved.domain,
      targetAudience: goals.audience,
      objectives: goals.objectives.split("\n").filter(Boolean),
      language: goals.language,
      level: goals.difficulty,
      lessons: [] as CourseDocument["lessons"],
    };
    for (let i = 0; i < approved.lessons.length; i++) {
      setMessage(`Generating lesson ${i + 1}/${approved.lessons.length}…`);
      const lesson = await request("/api/builder", "POST", {
        action: "lesson",
        goals: checkedGoals,
        outline: approved,
        index: i,
      });
      next.lessons.push(lesson);
      setCandidate(structuredClone(next));
    }
    next.estimatedMinutes = next.lessons.reduce((n, l) => n + l.minutes, 0);
    setCandidate(parseCourse(next));
    setMessage(
      "Review the proposal lesson by lesson. Accepting keeps ids at the same position and only changes the editor.",
    );
  }
  const hasRecords = !!impact && impact.attempts + impact.enrolments + impact.progress > 0;
  const blockReason =
    selected && selected.status !== "draft"
      ? "This course is published or archived. Replacing the whole draft is blocked so existing lesson and activity IDs stay attached to learner records. Accept one lesson at a time, or edit by hand."
      : hasRecords
        ? "Learner records already exist for this course. Replacing the whole draft is blocked. Accept one lesson at a time to keep IDs at the same position."
        : null;
  function acceptLesson(index: number) {
    if (!document || !candidate) return;
    try {
      setDocument(acceptProposalLesson(document, candidate.lessons[index], index));
      setHiddenLessons((current) => (current.includes(index) ? current : [...current, index]));
      setMessage("Lesson accepted into the editor. IDs at that position were kept. Save separately.");
    } catch (error) {
      setMessage((error as Error).message);
    }
  }
  function acceptRemaining() {
    if (!document || !candidate || blockReason) return;
    if (outline && candidate.lessons.length !== outline.lessons.length) return;
    try {
      if (hiddenLessons.length === 0) {
        setDocument(mergeCourseDraft(document, candidate));
      } else {
        const hidden = new Set(hiddenLessons);
        let next = document;
        candidate.lessons.forEach((lesson, index) => {
          if (!hidden.has(index)) next = acceptProposalLesson(next, lesson, index);
        });
        setDocument(next);
      }
      setCandidate(null);
      setHiddenLessons([]);
      setTab("edit");
      setMessage("Proposal merged into the editor. Existing IDs were kept by position. Save separately.");
    } catch (error) {
      setMessage((error as Error).message);
    }
  }
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <h1 className="text-3xl font-bold">
        {teacher ? "Teaching studio" : "My private courses & learning path"}
      </h1>
      <p className="text-stone-600">
        {teacher
          ? "Design learning in any subject. Choose activities, review AI suggestions, then publish."
          : "Create a mini-course in any subject. Order lessons into your personal learning path. Your courses stay private."}
      </p>
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
          <div className="flex flex-wrap gap-3">
            <button
              disabled={busy}
              className={primary}
              onClick={() =>
                run(async () => {
                  if (dirty && !confirm("Discard unsaved changes?")) return;
                  const row = await request(
                    "/api/courses",
                    "POST",
                    newCourse(),
                  );
                  setRows((r) => [row, ...r]);
                  setSelected(row);
                  setDocument(row.document);
                  setTab("edit");
                  setOutline(null);
                  setCandidate(null);
                })
              }
            >
              Create course
            </button>
            <button
              disabled={busy}
              className={secondary}
              onClick={() =>
                run(async () => {
                  const data = await request("/api/enrolments", "POST", {
                    action: "claim",
                  });
                  setMessage(
                    `Joined ${data.joined} course(s). Find published courses on the home page.`,
                  );
                })
              }
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
                  run(async () => {
                    if (dirty && !confirm("Discard unsaved changes?")) return;
                    const row = await request(
                      "/api/courses",
                      "POST",
                      exampleCourse(subject),
                    );
                    setRows((r) => [row, ...r]);
                    setSelected(row);
                    setDocument(row.document);
                    setTab("edit");
                    setOutline(null);
                    setCandidate(null);
                  })
                }
              >
                Start{" "}
                {subject === "software" ? "Software Engineering" : "English"}{" "}
                example
              </button>
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
            <aside className="space-y-2">
              {rows.map((row) => (
                <div
                  key={row.id}
                  className={`block w-full rounded-xl border p-4 text-left ${selected?.id === row.id ? "border-indigo-500 bg-indigo-50" : "bg-white"}`}
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
                    onClick={(e) => e.stopPropagation()}
                  >
                    Open course →
                  </Link>
                </div>
              ))}
            </aside>
            {document && selected && (
              <div className="min-w-0 space-y-5">
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      "edit",
                      "ai",
                      "preview",
                      ...(teacher ? ["students"] : []),
                    ] as (typeof tab)[]
                  ).map((t) => (
                    <button
                      key={t}
                      className={tab === t ? primary : secondary}
                      disabled={busy}
                      onClick={() => {
                        if (t === "preview" && dirty) {
                          setMessage(
                            "Save changes before preview so AI uses the same content.",
                          );
                          return;
                        }
                        setTab(t);
                        setPreviewIndex(0);
                      }}
                    >
                      {t === "ai"
                        ? "AI builder"
                        : t === "preview"
                          ? "Student preview"
                          : t === "students"
                            ? "Students & results"
                            : "Edit course"}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-white p-4">
                  <button
                    disabled={busy}
                    className={primary}
                    onClick={() =>
                      run(async () => {
                        await save();
                      })
                    }
                  >
                    Save {selected.status === "draft" ? "draft" : "changes"}
                  </button>
                  <span className="text-sm text-stone-500">
                    {dirty
                      ? "Unsaved changes"
                      : `Saved revision ${selected.revision}`}
                  </span>
                  {teacher && (
                    <>
                      <select
                        aria-label="Course access"
                        value={visibility}
                        onChange={(e) =>
                          setVisibility(
                            e.target.value as CourseRecord["visibility"],
                          )
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
                          onClick={() =>
                            run(async () => {
                              await save("draft", "private");
                            })
                          }
                        >
                          Unpublish
                        </button>
                      )}
                    </>
                  )}
                  {teacher && selected.status !== "archived" && (
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
                  {selected.status === "draft" && (
                    <button
                      disabled={busy}
                      className="text-sm text-red-700"
                      onClick={() =>
                        run(async () => {
                          if (
                            !confirm(
                              "Delete this draft? Courses with learner records cannot be deleted; archive those instead.",
                            )
                          )
                            return;
                          await request(
                            `/api/courses?id=${selected.id}`,
                            "DELETE",
                          );
                          setRows((r) => r.filter((c) => c.id !== selected.id));
                          setSelected(null);
                          setDocument(null);
                        })
                      }
                    >
                      Delete draft
                    </button>
                  )}
                </div>
                {tab === "edit" && (
                  <>
                    <section className="grid gap-4 rounded-2xl border bg-white p-5 sm:grid-cols-2">
                      {(
                        [
                          "title",
                          "domain",
                          "targetAudience",
                          "language",
                          "level",
                          "tagline",
                        ] as const
                      ).map((key) => (
                        <label className="text-sm capitalize" key={key}>
                          {key}
                          <input
                            className="mt-1 w-full rounded border p-2"
                            value={document[key]}
                            onChange={(e) =>
                              setDocument({
                                ...document,
                                [key]: e.target.value,
                              })
                            }
                          />
                        </label>
                      ))}
                      <label className="text-sm sm:col-span-2">
                        Description
                        <textarea
                          className="mt-1 w-full rounded border p-2"
                          value={document.description}
                          onChange={(e) =>
                            setDocument({
                              ...document,
                              description: e.target.value,
                            })
                          }
                        />
                      </label>
                      {(["objectives", "prerequisites"] as const).map((key) => (
                        <label className="text-sm capitalize" key={key}>
                          {key} (one per line)
                          <textarea
                            className="mt-1 w-full rounded border p-2"
                            value={document[key].join("\n")}
                            onChange={(e) =>
                              setDocument({
                                ...document,
                                [key]: e.target.value
                                  .split("\n")
                                  .filter(Boolean),
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
                          onChange={(e) =>
                            setDocument({
                              ...document,
                              estimatedMinutes: Number(e.target.value),
                            })
                          }
                        />
                      </label>
                    </section>
                    {document.lessons.map((lesson, li) => (
                      <section
                        className="space-y-4 rounded-2xl border bg-white p-5"
                        key={lesson.id}
                      >
                        <div className="flex gap-3">
                          <h2 className="flex-1 text-xl font-semibold">
                            Lesson {li + 1}
                          </h2>
                          <button
                            aria-label="Move lesson up"
                            onClick={() =>
                              setDocument({
                                ...document,
                                lessons: move(document.lessons, li, -1),
                              })
                            }
                          >
                            ↑
                          </button>
                          <button
                            aria-label="Move lesson down"
                            onClick={() =>
                              setDocument({
                                ...document,
                                lessons: move(document.lessons, li, 1),
                              })
                            }
                          >
                            ↓
                          </button>
                          <button
                            className="text-red-700"
                            onClick={() => {
                              if (
                                confirm(
                                  "Remove this lesson? Existing records remain archived.",
                                )
                              )
                                setDocument({
                                  ...document,
                                  lessons: document.lessons.filter(
                                    (_, i) => i !== li,
                                  ),
                                });
                            }}
                          >
                            Remove
                          </button>
                        </div>
                        <label className="block text-sm">
                          Lesson title
                          <input
                            className="mt-1 w-full rounded border p-2"
                            value={lesson.title}
                            onChange={(e) =>
                              updateLesson(li, { title: e.target.value })
                            }
                          />
                        </label>
                        <label className="block text-sm">
                          Summary
                          <textarea
                            className="mt-1 w-full rounded border p-2"
                            value={lesson.summary}
                            onChange={(e) =>
                              updateLesson(li, { summary: e.target.value })
                            }
                          />
                        </label>
                        <label className="block text-sm">
                          Objectives (one per line)
                          <textarea
                            className="mt-1 w-full rounded border p-2"
                            value={lesson.objectives.join("\n")}
                            onChange={(e) =>
                              updateLesson(li, {
                                objectives: e.target.value
                                  .split("\n")
                                  .filter(Boolean),
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
                            onChange={(e) =>
                              updateLesson(li, {
                                minutes: Number(e.target.value),
                              })
                            }
                          />
                        </label>
                        {lesson.blocks.map((block, bi) => (
                          <details
                            open
                            className="rounded-xl border bg-stone-50 p-4"
                            key={block.id}
                          >
                            <summary className="font-semibold">
                              {bi + 1}.{" "}
                              {activityDefinitions[block.activityType].label}
                            </summary>
                            <div className="my-3 flex flex-wrap gap-3">
                              <button
                                onClick={() =>
                                  updateLesson(li, {
                                    blocks: move(lesson.blocks, bi, -1),
                                  })
                                }
                              >
                                ↑ Move up
                              </button>
                              <button
                                onClick={() =>
                                  updateLesson(li, {
                                    blocks: move(lesson.blocks, bi, 1),
                                  })
                                }
                              >
                                ↓ Move down
                              </button>
                              <button
                                className="text-red-700"
                                onClick={() =>
                                  updateLesson(li, {
                                    blocks: lesson.blocks.filter(
                                      (_, i) => i !== bi,
                                    ),
                                  })
                                }
                              >
                                Remove activity
                              </button>
                              <select
                                aria-label="Replace activity type"
                                value={block.activityType}
                                onChange={(e) => {
                                  if (
                                    confirm(
                                      "Replace this activity configuration?",
                                    )
                                  )
                                    updateBlock(li, bi, {
                                      ...newActivity(
                                        e.target.value as ActivityType,
                                      ),
                                      id: block.id,
                                    });
                                }}
                              >
                                {Object.entries(activityDefinitions).map(
                                  ([key, v]) => (
                                    <option value={key} key={key}>
                                      {v.label}
                                    </option>
                                  ),
                                )}
                              </select>
                            </div>
                            <ActivityEditor
                              activity={block}
                              onChange={(a) => updateBlock(li, bi, a)}
                            />
                            <label className="mt-4 block text-sm">
                              AI revision request
                              <input
                                className="mt-1 w-full rounded border p-2"
                                value={instruction}
                                onChange={(e) => setInstruction(e.target.value)}
                                placeholder="E.g. simplify the language or change to a negotiation scenario"
                              />
                            </label>
                            <button
                              disabled={busy || !instruction.trim()}
                              className={`${secondary} mt-2`}
                              onClick={() =>
                                run(async () => {
                                  const after = await request(
                                    "/api/builder",
                                    "POST",
                                    {
                                      action: "refine",
                                      activity: block,
                                      instruction,
                                      goals: {
                                        ...goals,
                                        topic: document.domain,
                                        audience:
                                          document.targetAudience ||
                                          "General learners",
                                        objectives:
                                          lesson.objectives.join("\n") ||
                                          document.objectives.join("\n") ||
                                          lesson.title,
                                        difficulty: document.level,
                                        language: document.language,
                                      },
                                    },
                                  );
                                  setProposal({
                                    lesson: li,
                                    block: bi,
                                    before: block,
                                    after,
                                  });
                                })
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
                              onClick={() =>
                                updateLesson(li, {
                                  blocks: [
                                    ...lesson.blocks,
                                    newActivity(type as ActivityType),
                                  ],
                                })
                              }
                            >
                              +{" "}
                              {activityDefinitions[type as ActivityType].label}
                            </button>
                          ))}
                        </div>
                      </section>
                    ))}
                    <button
                      className={secondary}
                      onClick={() =>
                        setDocument({
                          ...document,
                          lessons: [
                            ...document.lessons,
                            {
                              id: crypto.randomUUID(),
                              title: "New lesson",
                              summary: "",
                              minutes: 10,
                              objectives: [],
                              blocks: [],
                            },
                          ],
                        })
                      }
                    >
                      + Add lesson
                    </button>
                    {proposal && (
                      <section className="space-y-3 rounded-xl border-2 border-indigo-400 bg-white p-4">
                        <h2 className="font-semibold">
                          Review proposed change
                        </h2>
                        <div className="grid gap-3 md:grid-cols-2">
                          <ActivitySummary
                            title="Before"
                            activity={proposal.before}
                            compareTo={proposal.after}
                          />
                          <div className="space-y-3">
                            <ActivitySummary
                              title="Proposed"
                              activity={proposal.after}
                              compareTo={proposal.before}
                            />
                            <ActivityEditor
                              activity={proposal.after}
                              onChange={(after) =>
                                setProposal({ ...proposal, after })
                              }
                            />
                          </div>
                        </div>
                        <button
                          className={primary}
                          onClick={() => {
                            const li = document.lessons.findIndex((l) =>
                              l.blocks.some((b) => b.id === proposal.before.id),
                            );
                            const bi =
                              li < 0
                                ? -1
                                : document.lessons[li].blocks.findIndex(
                                    (b) => b.id === proposal.before.id,
                                  );
                            if (li < 0 || bi < 0) {
                              setMessage(
                                "The original activity was removed. Reject this proposal.",
                              );
                              return;
                            }
                            if (
                              JSON.stringify(
                                document.lessons[li].blocks[bi],
                              ) !== JSON.stringify(proposal.before)
                            ) {
                              setMessage(
                                "The activity changed after the proposal. Reject and generate a fresh revision.",
                              );
                              return;
                            }
                            updateBlock(li, bi, proposal.after);
                            setProposal(null);
                          }}
                        >
                          Accept into editor
                        </button>
                        <button
                          className={`${secondary} ml-2`}
                          onClick={() => setProposal(null)}
                        >
                          Reject
                        </button>
                      </section>
                    )}
                  </>
                )}
                {tab === "ai" && (
                  <section className="space-y-5 rounded-2xl border bg-white p-5">
                    <h2 className="text-xl font-semibold">
                      1. Define learning goals
                    </h2>
                    {Object.entries(goals).map(([key, value]) => (
                      <label className="block text-sm capitalize" key={key}>
                        {key === "references"
                          ? "Reference material (paste text; URLs are not fetched)"
                          : key}
                        <textarea
                          className="mt-1 w-full rounded border p-2"
                          value={value}
                          onChange={(e) => {
                            setGoals({ ...goals, [key]: e.target.value });
                            setCandidate(null);
                          }}
                        />
                      </label>
                    ))}
                    <button
                      className={primary}
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          setCandidate(null);
                          setOutline(
                            await request("/api/builder", "POST", {
                              action: "outline",
                              goals,
                            }),
                          );
                        })
                      }
                    >
                      Generate outline
                    </button>
                    {outline && (
                      <>
                        <h2 className="text-xl font-semibold">
                          2. Edit and approve outline
                        </h2>
                        <label className="block">
                          Course title
                          <input
                            className="ml-2 rounded border p-2"
                            value={outline.title}
                            onChange={(e) =>
                              setOutline({ ...outline, title: e.target.value })
                            }
                          />
                        </label>
                        {outline.lessons.map((l, i) => (
                          <div key={i} className="space-y-2 rounded border p-3">
                            <input
                              aria-label={`Outline lesson ${i + 1} title`}
                              className="w-full rounded border p-2"
                              value={l.title}
                              onChange={(e) =>
                                setOutline({
                                  ...outline,
                                  lessons: outline.lessons.map((v, j) =>
                                    i === j
                                      ? { ...v, title: e.target.value }
                                      : v,
                                  ),
                                })
                              }
                            />
                            <textarea
                              aria-label="Outline objectives"
                              className="w-full rounded border p-2"
                              value={l.objectives.join("\n")}
                              onChange={(e) =>
                                setOutline({
                                  ...outline,
                                  lessons: outline.lessons.map((v, j) =>
                                    i === j
                                      ? {
                                          ...v,
                                          objectives:
                                            e.target.value.split("\n"),
                                        }
                                      : v,
                                  ),
                                })
                              }
                            />
                            <div className="flex flex-wrap gap-3">
                              {Object.entries(activityDefinitions).map(
                                ([type, def]) => (
                                  <label className="text-sm" key={type}>
                                    <input
                                      type="checkbox"
                                      checked={l.suggestedActivities.includes(
                                        type as ActivityType,
                                      )}
                                      onChange={(e) =>
                                        setOutline({
                                          ...outline,
                                          lessons: outline.lessons.map(
                                            (v, j) =>
                                              j === i
                                                ? {
                                                    ...v,
                                                    suggestedActivities: e
                                                      .target.checked
                                                      ? [
                                                          ...v.suggestedActivities,
                                                          type as ActivityType,
                                                        ]
                                                      : v.suggestedActivities.filter(
                                                          (t) => t !== type,
                                                        ),
                                                  }
                                                : v,
                                          ),
                                        })
                                      }
                                    />
                                    {def.label}
                                  </label>
                                ),
                              )}
                            </div>
                            <button
                              onClick={() =>
                                setOutline({
                                  ...outline,
                                  lessons: move(outline.lessons, i, -1),
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
                                  lessons: move(outline.lessons, i, 1),
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
                                    (_, j) => j !== i,
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
                            {outline.limitations.map((l, i) => (
                              <li key={i}>{l}</li>
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
                        onRejectLesson={(index) =>
                          setHiddenLessons((current) =>
                            current.includes(index) ? current : [...current, index],
                          )
                        }
                        onAcceptAll={acceptRemaining}
                        onRejectAll={() => {
                          setCandidate(null);
                          setHiddenLessons([]);
                        }}
                      />
                    )}
                  </section>
                )}
                {tab === "preview" && (
                  <section>
                    <p className="mb-3 rounded bg-amber-50 p-3">
                      Preview uses your saved course. Student records are not
                      changed.
                    </p>
                    <select
                      className="rounded border p-2"
                      value={previewIndex}
                      onChange={(e) => setPreviewIndex(Number(e.target.value))}
                    >
                      {selected.document.lessons.map((l, i) => (
                        <option value={i} key={l.id}>
                          {l.title}
                        </option>
                      ))}
                    </select>
                    {selected.document.lessons[previewIndex] && (
                      <LessonPlayer
                        key={`${selected.revision}-${previewIndex}`}
                        course={selected.document}
                        lesson={selected.document.lessons[previewIndex]}
                        preview
                      />
                    )}
                  </section>
                )}
                {tab === "students" && teacher && (
                  <Analytics key={selected.id} courseId={selected.id} />
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
