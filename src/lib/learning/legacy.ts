import { BACKGROUND_LABELS, type Background, type Course } from "@/lib/types";
/** Preserve legacy IDs and blocks while supplying domain-neutral metadata. */
export function adaptStaticCourse(course: Course): Course {
  return {
    ...course,
    domain: course.domain ?? "Software Engineering",
    targetAudience:
      course.targetAudience ??
      course.audience
        .map((a) => BACKGROUND_LABELS[a as Background] ?? a)
        .join(", "),
    prerequisites: course.prerequisites ?? [],
    objectives: course.objectives ?? [],
    language: course.language ?? "English",
    estimatedMinutes:
      course.estimatedMinutes ??
      course.lessons.reduce((n, l) => n + l.minutes, 0),
  };
}
