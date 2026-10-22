import type { Course, Lesson } from "@/lib/types";
import { aiCodingAgents } from "./ai-coding-agents";
import { seEssentials } from "./se-essentials";

export const courses: Course[] = [seEssentials, aiCodingAgents];

export function getCourse(courseId: string): Course | undefined {
  return courses.find((c) => c.id === courseId);
}

export function getLesson(courseId: string, lessonId: string): { course: Course; lesson: Lesson } | undefined {
  const course = getCourse(courseId);
  const lesson = course?.lessons.find((l) => l.id === lessonId);
  return course && lesson ? { course, lesson } : undefined;
}

/** Plain-text version of a lesson, given to the AI tutor as context. */
export function lessonAsText(lesson: Lesson): string {
  return lesson.blocks
    .map((b) => {
      switch (b.type) {
        case "activity":
          return JSON.stringify({ type: b.activityType, objectives: b.objectives, config: b.activityType === "choice" ? { question: b.config.question, options: b.config.options } : b.config });
        case "text":
          return b.markdown;
        case "quiz":
          return `Quiz: ${b.question}\nOptions: ${b.options.join(" | ")}`;
        case "ordering":
          return `Ordering exercise: ${b.prompt}`;
        case "roleplay":
          return `Role-play exercise: ${b.scenario}`;
        case "prompt-lab":
          return `Writing exercise: ${b.task}`;
        case "code-review":
          return `Code review exercise: ${b.context}\n\`\`\`${b.language}\n${b.code}\n\`\`\``;
      }
    })
    .join("\n\n");
}
