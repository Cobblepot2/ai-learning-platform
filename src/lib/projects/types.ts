import type { SimulationConfig, SimulationOutcome } from "@/lib/learning/simulation/schema";

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

/** Someone on the job, shown in the opening briefing. */
export type CastMember = {
  kind: "client" | "manager" | "assistant" | "users";
  name: string;
  role: string;
  note: string;
};

/**
 * A concept the job depends on, explained in the report. It counts as found when the learner
 * uncovers its fact on the call.
 */
export type ProjectConcept = {
  id: string;
  /** The fact that unlocks it. */
  fact: string;
  name: string;
  explanation: string;
  /** An analogy from the learner's own field. */
  bridge: string;
  /** The wrong belief the assistant's flawed version acts on. */
  misconception: string;
  inTheJob: string;
  /** The flawed version that acts on the misconception; sending it back asks the learner to explain why. */
  variant: string;
  /** Words that show the learner's explanation is about this concept. Used offline. */
  cues: string[];
};

/** A short email that follows from the learner's first move. */
export type FollowUp = { subject: string; body: string };

export type ProjectScenario = {
  id: string;
  /** Bump when content changes; running sessions created on another version restart. */
  version: number;
  title: string;
  tagline: string;
  summary: string;
  client: { name: string; role: string; organisation: string; persona: string };
  /** The AI teammate who builds the work ("Cody, AI coding agent"). */
  assistant: { name: string; kind: string };
  cast: CastMember[];
  /** Short phrases the desktop's wording is built from. */
  words: {
    /** What the job delivers, with its article: "the booking board". */
    deliverable: string;
    /** The learner's manager, as named in their email. */
    manager: string;
  };
  /** The concepts the job teaches, named and explained in the report. */
  concepts?: ProjectConcept[];
  /** Mails after the first move. Generic wording is used when a scenario has none. */
  followUps?: { call: FollowUp; delegate: FollowUp; delegateCall: FollowUp; quote: FollowUp };
  /** Scenario-specific sentences in the report, where the runtime has no generic wording. */
  reportNotes: {
    /** Delegation: the brief kept the assistant to the agreed scope. */
    scopeKept: string;
    /** Diligence: the learner ran a pilot first. */
    pilot: string;
    /** Diligence, engineering track: the brief asked for a test. */
    testAsked?: string;
  };
  facts: ProjectFact[];
  inbox: InboxMessage[];
  interview: {
    opening: string;
    minQuestions: number;
    maxQuestions: number;
    /** Said when no fact fits the question. Rotated in order. */
    vagueReplies: string[];
    /** Facts the learner must uncover for the call to count as thorough (a trust bonus). */
    thoroughFacts: number;
  };
  /**
   * Why client trust moved, shown in the report. `reasons` is keyed by the action
   * whose effect changed trust; `outcome` adds a final change once the result is known.
   */
  trust: {
    reasons: Record<string, string>;
    outcome: Partial<Record<SimulationOutcome, { delta: number; reason: string }>>;
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
