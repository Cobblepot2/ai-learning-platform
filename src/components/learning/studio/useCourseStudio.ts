"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import {
  acceptProposalLesson,
  mergeCourseDraft,
  parseCourse,
  outlineSchema,
  goalsSchema,
  type CourseDocument,
  type CourseRecord,
} from "@/lib/learning/model";
import {
  newActivity,
  type ActivityType,
  type LearningActivity,
} from "@/lib/learning/registry";

export type StudioTab = "edit" | "ai" | "preview" | "students";

export type StudioOptions = {
  teacher?: boolean;
  initialCourseId?: string;
  /** Render a single course editor without the course picker or page chrome. */
  scoped?: boolean;
  /** The server route already checked the instructor role. */
  serverAuthorized?: boolean;
  initialTab?: "edit" | "ai";
};

export type ActivityProposal = {
  lesson: number;
  block: number;
  before: LearningActivity;
  after: LearningActivity;
};

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

export function move<T>(array: T[], index: number, direction: number): T[] {
  const next = [...array];
  const target = index + direction;
  if (target < 0 || target >= next.length) return array;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/**
 * All editor state and requests for one studio session. UI panels read this
 * through StudioProvider so feature work can happen in separate files.
 */
export function useCourseStudio({
  teacher = false,
  initialCourseId,
  scoped = false,
  serverAuthorized = false,
  initialTab = "edit",
}: StudioOptions) {
  const [account, setAccount] = useState<{ isTeacher: boolean } | null>(
    serverAuthorized ? { isTeacher: true } : null,
  );
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
  const [proposal, setProposal] = useState<ActivityProposal | null>(null);
  const [instruction, setInstruction] = useState("");
  const [tab, setTab] = useState<StudioTab>(initialTab);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [visibility, setVisibility] =
    useState<CourseRecord["visibility"]>("enrolled");

  const dirty =
    !!document &&
    !!selected &&
    JSON.stringify(document) !== JSON.stringify(selected.document);

  function goalsFor(row: CourseRecord) {
    return {
      ...initialGoals,
      topic: row.document.domain,
      audience: row.document.targetAudience,
      objectives: row.document.objectives.join("\n"),
      difficulty: row.document.level,
      language: row.document.language,
    };
  }

  function applyRow(row: CourseRecord) {
    setSelected(row);
    setDocument(structuredClone(row.document));
    setVisibility(row.visibility);
    setOutline(null);
    setCandidate(null);
    setHiddenLessons([]);
    setProposal(null);
    setTab(initialTab);
    setGoals(goalsFor(row));
  }

  useEffect(() => {
    const accountRequest = serverAuthorized
      ? Promise.resolve({ isTeacher: true })
      : request("/api/me");
    accountRequest
      .then((a) => {
        setAccount(a);
        return request("/api/courses");
      })
      .then((rows: CourseRecord[]) => {
        setRows(rows);
        if (!initialCourseId) return;
        const target = rows.find((row) => row.id === initialCourseId);
        if (!target) {
          if (scoped) {
            setMessage("Course not found in your teaching workspace.");
          }
          return;
        }
        applyRow(target);
      })
      .catch((e) => setMessage((e as Error).message));
    // applyRow is intentionally not a dependency: it is a reset helper whose
    // inputs are the options below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCourseId, initialTab, scoped, serverAuthorized]);

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
    applyRow(row);
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
    setVisibility(row.visibility);
    setMessage("Saved.");
    return row as CourseRecord;
  }

  function updateDocument(patch: Partial<CourseDocument>) {
    setDocument((prev) => (prev ? { ...prev, ...patch } : prev));
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
    setDocument((prev) =>
      prev
        ? {
            ...prev,
            lessons: prev.lessons.map((lesson, i) =>
              i === li
                ? {
                    ...lesson,
                    blocks: lesson.blocks.map((block, j) =>
                      j === bi ? activity : block,
                    ),
                  }
                : lesson,
            ),
          }
        : prev,
    );
  }

  function addLesson() {
    setDocument((prev) =>
      prev
        ? {
            ...prev,
            lessons: [
              ...prev.lessons,
              {
                id: crypto.randomUUID(),
                title: "New lesson",
                summary: "",
                minutes: 10,
                objectives: [],
                blocks: [],
              },
            ],
          }
        : prev,
    );
  }

  function removeLesson(index: number) {
    if (!confirm("Remove this lesson? Existing records remain archived.")) return;
    setDocument((prev) =>
      prev
        ? { ...prev, lessons: prev.lessons.filter((_, i) => i !== index) }
        : prev,
    );
  }

  function moveLesson(index: number, direction: number) {
    setDocument((prev) =>
      prev ? { ...prev, lessons: move(prev.lessons, index, direction) } : prev,
    );
  }

  function addActivity(lessonIndex: number, type: ActivityType) {
    setDocument((prev) =>
      prev
        ? {
            ...prev,
            lessons: prev.lessons.map((lesson, i) =>
              i === lessonIndex
                ? { ...lesson, blocks: [...lesson.blocks, newActivity(type)] }
                : lesson,
            ),
          }
        : prev,
    );
  }

  function removeActivity(lessonIndex: number, blockIndex: number) {
    setDocument((prev) =>
      prev
        ? {
            ...prev,
            lessons: prev.lessons.map((lesson, i) =>
              i === lessonIndex
                ? {
                    ...lesson,
                    blocks: lesson.blocks.filter((_, j) => j !== blockIndex),
                  }
                : lesson,
            ),
          }
        : prev,
    );
  }

  function moveActivity(lessonIndex: number, blockIndex: number, direction: number) {
    setDocument((prev) =>
      prev
        ? {
            ...prev,
            lessons: prev.lessons.map((lesson, i) =>
              i === lessonIndex
                ? { ...lesson, blocks: move(lesson.blocks, blockIndex, direction) }
                : lesson,
            ),
          }
        : prev,
    );
  }

  function replaceActivityType(
    lessonIndex: number,
    blockIndex: number,
    type: ActivityType,
  ) {
    const block = document?.lessons[lessonIndex]?.blocks[blockIndex];
    if (!block) return;
    if (!confirm("Replace this activity configuration?")) return;
    updateBlock(lessonIndex, blockIndex, {
      ...newActivity(type),
      id: block.id,
    } as LearningActivity);
  }

  async function createCourse(next: CourseDocument) {
    if (dirty && !confirm("Discard unsaved changes?")) return;
    const row = await request("/api/courses", "POST", next);
    setRows((r) => [row, ...r]);
    setSelected(row);
    setDocument(row.document);
    setVisibility(row.visibility);
    setTab("edit");
    setOutline(null);
    setCandidate(null);
  }

  async function joinInvited() {
    const data = await request("/api/enrolments", "POST", { action: "claim" });
    setMessage(
      `Joined ${data.joined} course(s). Find published courses on the home page.`,
    );
  }

  async function deleteDraft() {
    if (!selected) return;
    if (
      !confirm(
        "Delete this draft? Courses with learner records cannot be deleted; archive those instead.",
      )
    )
      return;
    await request(`/api/courses?id=${selected.id}`, "DELETE");
    setRows((r) => r.filter((c) => c.id !== selected.id));
    setSelected(null);
    setDocument(null);
  }

  async function generateOutline() {
    setCandidate(null);
    setOutline(
      await request("/api/builder", "POST", { action: "outline", goals }),
    );
  }

  const hasRecords =
    !!impact && impact.attempts + impact.enrolments + impact.progress > 0;
  const blockReason =
    selected && selected.status !== "draft"
      ? "This course is published or archived. Replacing the whole draft is blocked so existing lesson and activity IDs stay attached to learner records. Accept one lesson at a time, or edit by hand."
      : hasRecords
        ? "Learner records already exist for this course. Replacing the whole draft is blocked. Accept one lesson at a time to keep IDs at the same position."
        : null;

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

  function acceptLesson(index: number) {
    if (!document || !candidate) return;
    try {
      setDocument(acceptProposalLesson(document, candidate.lessons[index], index));
      setHiddenLessons((current) =>
        current.includes(index) ? current : [...current, index],
      );
      setMessage(
        "Lesson accepted into the editor. IDs at that position were kept. Save separately.",
      );
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  function rejectLesson(index: number) {
    setHiddenLessons((current) =>
      current.includes(index) ? current : [...current, index],
    );
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
      setMessage(
        "Proposal merged into the editor. Existing IDs were kept by position. Save separately.",
      );
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  function rejectAll() {
    setCandidate(null);
    setHiddenLessons([]);
  }

  async function proposeRevision(
    lessonIndex: number,
    blockIndex: number,
    block: LearningActivity,
  ) {
    if (!document) return;
    const lesson = document.lessons[lessonIndex];
    const after = await request("/api/builder", "POST", {
      action: "refine",
      activity: block,
      instruction,
      goals: {
        ...goals,
        topic: document.domain,
        audience: document.targetAudience || "General learners",
        objectives:
          lesson.objectives.join("\n") ||
          document.objectives.join("\n") ||
          lesson.title,
        difficulty: document.level,
        language: document.language,
      },
    });
    setProposal({
      lesson: lessonIndex,
      block: blockIndex,
      before: block,
      after,
    });
  }

  function acceptProposal() {
    if (!document || !proposal) return;
    const li = document.lessons.findIndex((lesson) =>
      lesson.blocks.some((block) => block.id === proposal.before.id),
    );
    const bi =
      li < 0
        ? -1
        : document.lessons[li].blocks.findIndex(
            (block) => block.id === proposal.before.id,
          );
    if (li < 0 || bi < 0) {
      setMessage("The original activity was removed. Reject this proposal.");
      return;
    }
    if (
      JSON.stringify(document.lessons[li].blocks[bi]) !==
      JSON.stringify(proposal.before)
    ) {
      setMessage(
        "The activity changed after the proposal. Reject and generate a fresh revision.",
      );
      return;
    }
    updateBlock(li, bi, proposal.after);
    setProposal(null);
  }

  return {
    teacher,
    scoped,
    initialTab,
    account,
    rows,
    selected,
    document,
    goals,
    outline,
    candidate,
    hiddenLessons,
    impact,
    proposal,
    instruction,
    tab,
    previewIndex,
    busy,
    message,
    visibility,
    dirty,
    hasRecords,
    blockReason,
    setMessage,
    setGoals,
    setOutline,
    setCandidate,
    setHiddenLessons,
    setProposal,
    setInstruction,
    setTab,
    setPreviewIndex,
    setVisibility,
    run,
    select,
    save,
    createCourse,
    joinInvited,
    deleteDraft,
    updateDocument,
    updateLesson,
    updateBlock,
    addLesson,
    removeLesson,
    moveLesson,
    addActivity,
    removeActivity,
    moveActivity,
    replaceActivityType,
    generateOutline,
    generate,
    acceptLesson,
    rejectLesson,
    acceptRemaining,
    rejectAll,
    proposeRevision,
    acceptProposal,
  };
}

export type StudioState = ReturnType<typeof useCourseStudio>;
