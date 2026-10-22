import { z } from "zod";
import {
  activitySchema,
  validateActivity,
  activityDefinitions,
  type ActivityType,
} from "./registry";
const short = z.string().trim().min(1).max(300);
export const lessonSchema = z.object({
  id: short,
  title: short,
  summary: z.string().max(3000),
  minutes: z.number().int().min(1).max(600),
  objectives: z.array(short).max(20),
  blocks: z.array(activitySchema).max(40),
});
export const courseSchema = z.object({
  id: z.string().uuid(),
  title: short,
  domain: short,
  description: z.string().max(10000),
  targetAudience: z.string().max(2000),
  prerequisites: z.array(short).max(20),
  objectives: z.array(short).max(20),
  language: short,
  level: short,
  estimatedMinutes: z.number().int().min(1).max(10000),
  tagline: z.string().max(300),
  emoji: z.string().max(20),
  audience: z.array(short).max(20),
  lessons: z.array(lessonSchema).max(30),
});
export type CourseDocument = z.infer<typeof courseSchema>;
export type CourseRecord = {
  id: string;
  owner_id: string;
  status: "draft" | "published" | "archived";
  visibility: "private" | "enrolled" | "public";
  revision: number;
  document: CourseDocument;
  created_at?: string;
  updated_at?: string;
};
export function parseCourse(value: unknown): CourseDocument {
  const course = courseSchema.parse(value);
  const ids = new Set<string>();
  for (const lesson of course.lessons) {
    if (ids.has(lesson.id)) throw new Error("Duplicate lesson/activity ID");
    ids.add(lesson.id);
    for (const activity of lesson.blocks) {
      if (ids.has(activity.id)) throw new Error("Duplicate lesson/activity ID");
      ids.add(activity.id);
      const result = validateActivity(activity);
      if (!result.success) throw new Error(result.error.message);
    }
  }
  return course;
}

function mergeLesson(
  existing: CourseDocument["lessons"][number] | undefined,
  proposed: CourseDocument["lessons"][number],
): CourseDocument["lessons"][number] {
  if (!existing) return proposed;
  return {
    ...proposed,
    id: existing.id,
    blocks: proposed.blocks.map((block, index) => {
      const previous = existing.blocks[index];
      return previous ? { ...block, id: previous.id } : block;
    }),
  };
}

/** Whole-draft accept: proposal content, course id and positional lesson/activity ids. */
export function mergeCourseDraft(
  current: CourseDocument,
  proposal: CourseDocument,
): CourseDocument {
  return parseCourse({
    ...proposal,
    id: current.id,
    lessons: proposal.lessons.map((lesson, index) =>
      mergeLesson(current.lessons[index], lesson),
    ),
  });
}

/** One lesson from a draft, written at the same index. Other lessons stay put. */
export function acceptProposalLesson(
  current: CourseDocument,
  proposed: CourseDocument["lessons"][number],
  index: number,
): CourseDocument {
  const lessons = [...current.lessons];
  const merged = mergeLesson(lessons[index], proposed);
  if (index < lessons.length) lessons[index] = merged;
  else lessons.push(merged);
  return parseCourse({ ...current, lessons });
}
export function newCourse(): CourseDocument {
  return {
    id: crypto.randomUUID(),
    title: "Untitled course",
    domain: "General",
    description: "",
    targetAudience: "",
    prerequisites: [],
    objectives: [],
    language: "English",
    level: "Beginner",
    estimatedMinutes: 20,
    tagline: "",
    emoji: "📚",
    audience: [],
    lessons: [],
  };
}
export const goalsSchema = z.object({
  topic: short,
  audience: short,
  objectives: z.string().min(1).max(4000),
  difficulty: short,
  requirements: z.string().max(4000),
  references: z.string().max(16000),
  length: z.string().min(1).max(200),
  language: short,
});
export const outlineSchema = z.object({
  title: short,
  domain: short,
  lessons: z
    .array(
      z.object({
        title: short,
        objectives: z.array(short).min(1).max(10),
        suggestedActivities: z
          .array(
            z.enum(
              Object.keys(activityDefinitions) as [
                ActivityType,
                ...ActivityType[],
              ],
            ),
          )
          .min(1)
          .max(6),
      }),
    )
    .min(1)
    .max(12),
  limitations: z.array(z.string().max(1000)).max(10),
});
