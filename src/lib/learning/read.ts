import type { Course, Lesson, LessonBlock } from "@/lib/types";
import { z } from "zod";
import { validateActivity } from "./registry";

export type CourseRead = {
  course: Course | null;
  notes: string[];
};

const courseMeta = z.object({
  id: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(300),
  domain: z.string().trim().max(300).optional(),
  description: z.string().max(10000).optional(),
  targetAudience: z.string().max(2000).optional(),
  prerequisites: z.array(z.string().max(300)).max(20).optional(),
  objectives: z.array(z.string().max(300)).max(20).optional(),
  language: z.string().trim().max(300).optional(),
  level: z.string().trim().max(300).optional(),
  estimatedMinutes: z.number().int().min(1).max(10000).optional(),
  tagline: z.string().max(300).optional(),
  emoji: z.string().max(20).optional(),
  audience: z.array(z.string().max(300)).max(20).optional(),
  lessons: z.array(z.unknown()).max(30),
});

const lessonMeta = z.object({
  id: z.string().trim().min(1).max(300),
  title: z.string().trim().min(1).max(300),
  summary: z.string().max(3000).optional().default(""),
  minutes: z.number().int().min(1).max(600).optional().default(10),
  objectives: z.array(z.string().max(300)).max(20).optional().default([]),
  blocks: z.array(z.unknown()).max(40).optional().default([]),
});

function coerceBlock(value: unknown, notes: string[], seen: Set<string>): LessonBlock | null {
  const parsed = validateActivity(value);
  if (parsed.success) {
    if (seen.has(parsed.data.id)) {
      notes.push(`Skipped duplicate activity id ${parsed.data.id}.`);
      return null;
    }
    seen.add(parsed.data.id);
    return parsed.data;
  }
  if (!value || typeof value !== "object") {
    notes.push(`Dropped a block: ${parsed.error.message}`);
    return null;
  }
  const record = value as Record<string, unknown>;
  const id =
    typeof record.id === "string" && record.id.trim()
      ? record.id.trim().slice(0, 300)
      : `invalid-${notes.length + 1}`;
  if (seen.has(id)) {
    notes.push(`Skipped duplicate activity id ${id}.`);
    return null;
  }
  seen.add(id);
  notes.push(`Unsupported activity ${id}: ${parsed.error.message}`);
  return {
    type: "activity",
    id,
    version: typeof record.version === "number" ? record.version : 0,
    activityType: typeof record.activityType === "string" ? record.activityType : "unknown",
    config: "config" in record ? record.config : {},
    objectives: Array.isArray(record.objectives)
      ? record.objectives.filter((item): item is string => typeof item === "string")
      : undefined,
  };
}

/**
 * Homepage and player reads. One bad course is skipped; one bad activity becomes
 * a placeholder instead of failing the whole catalogue.
 */
export function interpretStoredCourse(value: unknown): CourseRead {
  const notes: string[] = [];
  const meta = courseMeta.safeParse(value);
  if (!meta.success) {
    return {
      course: null,
      notes: [meta.error.issues[0]?.message ?? "Course document is not readable."],
    };
  }
  const seen = new Set<string>([meta.data.id]);
  const lessons: Lesson[] = [];
  meta.data.lessons.forEach((raw, index) => {
    const lesson = lessonMeta.safeParse(raw);
    if (!lesson.success) {
      notes.push(`Skipped lesson ${index + 1}: ${lesson.error.issues[0]?.message ?? "invalid lesson"}.`);
      return;
    }
    if (seen.has(lesson.data.id)) {
      notes.push(`Skipped duplicate lesson id ${lesson.data.id}.`);
      return;
    }
    seen.add(lesson.data.id);
    const blocks = lesson.data.blocks
      .map((block) => coerceBlock(block, notes, seen))
      .filter((block): block is LessonBlock => block !== null);
    lessons.push({ ...lesson.data, blocks });
  });
  const minutes = lessons.reduce((sum, lesson) => sum + lesson.minutes, 0);
  return {
    notes,
    course: {
      id: meta.data.id,
      title: meta.data.title,
      domain: meta.data.domain || "General",
      description: meta.data.description ?? "",
      targetAudience: meta.data.targetAudience ?? "",
      prerequisites: meta.data.prerequisites ?? [],
      objectives: meta.data.objectives ?? [],
      language: meta.data.language || "English",
      level: meta.data.level || "Beginner",
      estimatedMinutes: meta.data.estimatedMinutes ?? Math.max(minutes, 1),
      tagline: meta.data.tagline ?? "",
      emoji: meta.data.emoji || "📚",
      audience: meta.data.audience ?? [],
      lessons,
    },
  };
}
