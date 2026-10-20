export type Background = "non_cs" | "cs_student" | "cs_graduate" | "career_switcher";
export type Experience = "none" | "some" | "comfortable";
export type Goal = "understand" | "build" | "career";
export type Language = "en" | "zh";

export interface LearnerProfile {
  displayName: string;
  background: Background;
  experience: Experience;
  goal: Goal;
  language: Language;
}

export const BACKGROUND_LABELS: Record<Background, string> = {
  non_cs: "Non-CS major",
  cs_student: "CS student",
  cs_graduate: "CS graduate",
  career_switcher: "Career switcher",
};

export const EXPERIENCE_LABELS: Record<Experience, string> = {
  none: "Never written code",
  some: "Written a little code",
  comfortable: "Comfortable coding",
};

export const GOAL_LABELS: Record<Goal, string> = {
  understand: "Understand how software gets built",
  build: "Build my own product with AI",
  career: "Prepare for a software career",
};

// ---- Course content ----

export interface TextBlock {
  type: "text";
  id: string;
  markdown: string;
}

export interface QuizBlock {
  type: "quiz";
  id: string;
  question: string;
  options: string[];
  answer: number;
  explanation: string;
}

export interface OrderingBlock {
  type: "ordering";
  id: string;
  prompt: string;
  /** Items in the correct order; the UI shuffles them. */
  items: string[];
  explanation: string;
}

export interface RoleplayBlock {
  type: "roleplay";
  id: string;
  title: string;
  scenario: string;
  /** Who the AI plays, written as instructions for the model. */
  persona: string;
  /** Facts the learner is supposed to uncover by asking good questions. */
  hiddenRequirements: string[];
  openingLine: string;
  minTurns: number;
}

export interface PromptLabBlock {
  type: "prompt-lab";
  id: string;
  task: string;
  starter: string;
  rubric: string[];
}

export interface CodeReviewBlock {
  type: "code-review";
  id: string;
  context: string;
  language: string;
  code: string;
  /** 1-based line numbers that contain the planted problem. */
  bugLines: number[];
  explanation: string;
}

export type LessonBlock =
  | TextBlock
  | QuizBlock
  | OrderingBlock
  | RoleplayBlock
  | PromptLabBlock
  | CodeReviewBlock;

export interface Lesson {
  id: string;
  title: string;
  summary: string;
  minutes: number;
  blocks: LessonBlock[];
}

export interface Course {
  id: string;
  title: string;
  tagline: string;
  description: string;
  level: string;
  audience: Background[];
  emoji: string;
  lessons: Lesson[];
}

export interface BlockResult {
  done: boolean;
  score?: number;
}
