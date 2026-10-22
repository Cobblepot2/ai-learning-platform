export type Background = "general" | "non_cs" | "cs_student" | "cs_graduate" | "career_switcher";
export type Experience = "none" | "some" | "comfortable";
export type Goal = "understand" | "build" | "career";
export type Language = "en" | "zh-Hans" | "zh-Hant";
export type LearningStyle = "balanced" | "step_by_step" | "interactive";

export interface LearnerProfile {
  displayName: string;
  language: Language;
  goal: Goal;
  learningStyle: LearningStyle;
  /**
   * Legacy global fields. They are still read so existing profiles keep
   * working, but they no longer describe every course a learner takes.
   * Subject experience now belongs in CoursePreference.
   */
  background?: Background | null;
  experience?: Experience | null;
}

/** Optional preferences that apply to one course only. */
export interface CoursePreference {
  experience: Experience;
  goal: Goal;
}

export const BACKGROUND_LABELS: Record<Background, string> = {
  general: "General learner",
  non_cs: "Non-CS major",
  cs_student: "CS student",
  cs_graduate: "CS graduate",
  career_switcher: "Career switcher",
};

export const EXPERIENCE_LABELS: Record<Experience, string> = {
  none: "New to this subject",
  some: "Some experience",
  comfortable: "Confident",
};

export const GOAL_LABELS: Record<Goal, string> = {
  understand: "Understand new concepts",
  build: "Practise and apply what I learn",
  career: "Build practical or professional skills",
};

export const LANGUAGE_LABELS: Record<Language, string> = {
  en: "English",
  "zh-Hans": "简体中文",
  "zh-Hant": "繁體中文",
};

/** The name used when telling the model which language to answer in. */
export const LANGUAGE_NAMES: Record<Language, string> = {
  en: "English",
  "zh-Hans": "Simplified Chinese (简体中文)",
  "zh-Hant": "Traditional Chinese (繁體中文)",
};

export const LEARNING_STYLE_LABELS: Record<LearningStyle, string> = {
  balanced: "Balanced — explanations and practice",
  step_by_step: "Step-by-step guidance",
  interactive: "More interactive activities",
};

// ---- Course content ----

/** Kept in the player when a stored activity fails the registry, so the placeholder can render. */
export interface UnsupportedActivity {
  type: "activity";
  id: string;
  version: number;
  activityType: string;
  config: unknown;
  objectives?: string[];
}

/** Every lesson block is an Activity envelope from the shared registry. */
export type LessonBlock =
  | import("./learning/registry").LearningActivity
  | UnsupportedActivity;

export interface Lesson {
  id: string;
  title: string;
  summary: string;
  minutes: number;
  blocks: LessonBlock[];
  objectives?: string[];
}

export interface Course {
  domain?: string;
  targetAudience?: string;
  prerequisites?: string[];
  objectives?: string[];
  language?: string;
  estimatedMinutes?: number;
  id: string;
  title: string;
  tagline: string;
  description: string;
  level: string;
  /** Optional legacy recommendation tags; arbitrary domains may supply their own. */
  audience: string[];
  emoji: string;
  lessons: Lesson[];
}

export interface BlockResult {
  done: boolean;
  score?: number;
}
