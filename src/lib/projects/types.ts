import type { SimulationConfig } from "@/lib/learning/simulation/schema";

export type Competency = "delegation" | "description" | "discernment" | "diligence";
export type Track = "product" | "engineering";

/** How the workspace renders a stage. The engine itself only sees stage ids. */
export type StageKind =
  | "choice"
  | "interview"
  | "requirements"
  | "brief"
  | "review"
  | "release";

/** Something the client knows. The AI (or the offline fallback) may only reveal these. */
export type ProjectFact = {
  id: string;
  text: string;
  /** Words in a learner's question that make this fact relevant. Used offline. */
  cues: string[];
  /** What the client says when the fact comes up, in their own voice. */
  reply: string;
};

/**
 * One point a piece of learner writing should cover. `cues` is a list of groups;
 * offline grading treats the point as covered when every group has a match.
 */
export type ChecklistItem = {
  id: string;
  label: string;
  competency: Competency;
  cues: string[][];
  /** The fact the learner needed to uncover to know about this point. */
  fact?: string;
  /** Only graded on these tracks. Defaults to all. */
  tracks?: Track[];
};

export type InboxMessage = {
  id: string;
  kind: "email" | "ticket";
  from: string;
  subject: string;
  body: string;
};

export type CodeFile = {
  path: string;
  /** Shown as the pull request diff: every line is an added line. */
  lines: string[];
};

export type ReviewReason = { id: string; label: string };

export type DemoStep = { action: string; result: string };

export type CodeVariant = {
  id: string;
  prTitle: string;
  prSummary: string;
  files: CodeFile[];
  /** Lines (path + 1-based number) that contain this variant's problem. */
  problemLines: { path: string; line: number }[];
  /** The product-track reason that correctly describes the problem. */
  problemReason: string | null;
  /** Behaviour walkthrough shown on the product track. */
  demo: DemoStep[];
  /** Shown when the brief asked for a test (engineering track). */
  checks: { name: string; passed: boolean; detail: string }[];
};

/** Feedback written for the debrief, keyed by checklist item id or variant id. */
export type DebriefNotes = {
  missedFact: Record<string, string>;
  missedRequirement: Record<string, string>;
  missedConstraint: Record<string, string>;
};

export type ProjectScenario = {
  id: string;
  /** Bump when content changes; running sessions created on another version restart. */
  version: number;
  title: string;
  tagline: string;
  summary: string;
  client: { name: string; role: string; organisation: string; persona: string };
  facts: ProjectFact[];
  inbox: InboxMessage[];
  interview: {
    opening: string;
    minQuestions: number;
    maxQuestions: number;
    /** Said when no fact fits the question. Rotated in order. */
    vagueReplies: string[];
  };
  requirements: ChecklistItem[];
  brief: ChecklistItem[];
  /** Order matters: the first variant whose `when` constraint is missing wins. */
  variantRules: { missing: string; variant: string; action: string }[];
  defaultVariant: { variant: string; action: string };
  variants: CodeVariant[];
  /** Added to the pull request when the brief asked for a test. */
  testFile?: CodeFile;
  reviewReasons: ReviewReason[];
  stageKinds: Record<string, StageKind>;
  /** Track-specific wording for a stage, shown instead of the engine narrative. */
  trackNarratives?: Partial<Record<string, Partial<Record<Track, string>>>>;
  debriefNotes: DebriefNotes;
  config: SimulationConfig;
};
