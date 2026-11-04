import {
  applySimulationAction,
  availableActions,
  SimulationError,
  startSimulation,
  type SimulationEvent,
  type SimulationHistory,
  type SimulationState,
} from "@/lib/learning/simulation/engine";
import type { SimulationOutcome } from "@/lib/learning/simulation/schema";
import { normalise, type Grader, type InterviewTurn, type ProjectEvaluator } from "./evaluate";
import type {
  ChecklistItem,
  ProjectConcept,
  CodeVariant,
  Competency,
  ProjectScenario,
  StageKind,
  Track,
} from "./types";

export const MAX_WRITING = 3000;
export const MAX_QUESTION = 500;
export const MAX_EXPLANATION = 1000;

export type ProjectMemo = {
  scenarioVersion: number;
  interview: { turns: InterviewTurn[]; revealed: string[]; vagueIndex: number };
  // `grader` records who judged the writing: the keywords or a model, and why it fell back.
  requirements?: { text: string; covered: string[]; grader?: Grader };
  brief?: { text: string; covered: string[]; variant: string; grader?: Grader };
  /** The trust change applied once the outcome was known, if any. */
  outcomeTrust?: { delta: number; reason: string };
  reviews: {
    variant: string;
    reasonId?: string;
    path?: string;
    line?: number;
    correct: boolean;
    /** The learner's note on why the work goes wrong, graded when it caught a concept's flaw. */
    explanation?: { text: string; concept?: string; covered: string[]; grader?: Grader };
  }[];
};

export type ProjectStep = { state: SimulationState; events: SimulationEvent[] };

function emptyMemo(scenario: ProjectScenario): ProjectMemo {
  return {
    scenarioVersion: scenario.version,
    interview: { turns: [], revealed: [], vagueIndex: 0 },
    reviews: [],
  };
}

export function memoOf(state: SimulationState): ProjectMemo {
  const memo = state.memo as ProjectMemo | undefined;
  if (!memo || !memo.interview || !Array.isArray(memo.reviews)) {
    throw new SimulationError("This project run is unreadable. Restart it.", 409);
  }
  return memo;
}

function withMemo(state: SimulationState, memo: ProjectMemo): SimulationState {
  return { ...state, memo: memo as unknown as Record<string, unknown> };
}

export function trackOf(state: SimulationState): Track | null {
  const track = state.variables.track;
  return track === "product" || track === "engineering" ? track : null;
}

export function stageKind(scenario: ProjectScenario, state: SimulationState): StageKind {
  return scenario.stageKinds[state.stageId] ?? "choice";
}

function requireStage(state: SimulationState, stageId: string, message: string) {
  if (state.status === "completed") {
    throw new SimulationError("This project is already finished.");
  }
  if (state.stageId !== stageId) throw new SimulationError(message, 409);
}

function system(
  scenario: ProjectScenario,
  state: SimulationState,
  actionId: string,
): ProjectStep {
  const result = applySimulationAction(scenario.config, state, actionId, { system: true });
  return { state: result.state, events: [result.event] };
}

function itemsFor(items: ChecklistItem[], track: Track | null): ChecklistItem[] {
  return items.filter((item) => !item.tracks || (track && item.tracks.includes(track)));
}

/** Keep only ids that exist in the list, in list order. Model output is never trusted as-is. */
function validIds(ids: unknown, allowed: string[]): string[] {
  const given = new Set(Array.isArray(ids) ? ids.filter((id) => typeof id === "string") : []);
  return allowed.filter((id) => given.has(id));
}

function cleanText(text: unknown, max: number, what: string): string {
  if (typeof text !== "string" || !text.trim()) {
    throw new SimulationError(`Write your ${what} first.`);
  }
  if (text.length > max) {
    throw new SimulationError(`Keep your ${what} under ${max} characters.`);
  }
  return text.trim();
}

export function startProject(scenario: ProjectScenario): SimulationState {
  return withMemo(startSimulation(scenario.config), emptyMemo(scenario));
}

/** A choice the learner makes directly (track, inbox, approve, release). */
export function chooseAction(
  scenario: ProjectScenario,
  state: SimulationState,
  actionId: string,
): ProjectStep {
  memoOf(state);
  const result = applySimulationAction(scenario.config, state, actionId);
  return { state: settleOutcome(scenario, result.state), events: [result.event] };
}

/**
 * Completion rules have no effects, so the outcome's trust change is applied
 * here, once, when a choice finishes the run. It is clamped like any effect and
 * saved with its reason for the report.
 */
function settleOutcome(scenario: ProjectScenario, state: SimulationState): SimulationState {
  if (state.status !== "completed" || !state.outcome) return state;
  const memo = memoOf(state);
  const rule = scenario.trust.outcome[state.outcome];
  if (!rule || memo.outcomeTrust) return state;
  const variable = scenario.config.variables.find((item) => item.id === "trust");
  const [min, max] = variable?.type === "number" ? [variable.min, variable.max] : [0, 10];
  const before = Number(state.variables.trust ?? 0);
  const after = Math.min(max, Math.max(min, before + rule.delta));
  const next = { ...state, variables: { ...state.variables, trust: after } };
  return withMemo(next, { ...memo, outcomeTrust: { delta: after - before, reason: rule.reason } });
}

export async function askClient(
  scenario: ProjectScenario,
  state: SimulationState,
  question: unknown,
  evaluator: ProjectEvaluator,
): Promise<{ state: SimulationState; reply: string; revealed: string[] }> {
  requireStage(state, "interview", "The call with the client has ended.");
  const text = cleanText(question, MAX_QUESTION, "question");
  const memo = memoOf(state);
  const asked = memo.interview.turns.filter((turn) => turn.role === "learner").length;
  if (asked >= scenario.interview.maxQuestions) {
    throw new SimulationError(`${scenario.client.name.split(" ")[0]} has to go. End the call.`);
  }
  const answer = await evaluator.interview({
    scenario,
    question: text,
    turns: memo.interview.turns,
    revealed: memo.interview.revealed,
    vagueIndex: memo.interview.vagueIndex,
  });
  const revealed = validIds(
    answer.revealed,
    scenario.facts.map((fact) => fact.id),
  ).filter((id) => !memo.interview.revealed.includes(id));
  const reply =
    typeof answer.reply === "string" && answer.reply.trim()
      ? answer.reply.trim().slice(0, 1200)
      : scenario.interview.vagueReplies[0];
  const next: ProjectMemo = {
    ...memo,
    interview: {
      turns: [
        ...memo.interview.turns,
        { role: "learner", text },
        { role: "client", text: reply, grader: answer.grader },
      ],
      revealed: [...memo.interview.revealed, ...revealed],
      vagueIndex: memo.interview.vagueIndex + (revealed.length ? 0 : 1),
    },
  };
  return { state: withMemo(state, next), reply, revealed };
}

export function endInterview(scenario: ProjectScenario, state: SimulationState): ProjectStep {
  requireStage(state, "interview", "The call with the client has already ended.");
  const memo = memoOf(state);
  const asked = memo.interview.turns.filter((turn) => turn.role === "learner").length;
  if (asked < scenario.interview.minQuestions) {
    const left = scenario.interview.minQuestions - asked;
    throw new SimulationError(
      `Ask at least ${left} more question${left === 1 ? "" : "s"} before ending the call.`,
    );
  }
  // A call that uncovered most of what's wrong earns the client's trust.
  const thorough = memo.interview.revealed.length >= scenario.interview.thoroughFacts;
  return system(scenario, state, thorough ? "end-interview-thorough" : "end-interview");
}

export async function submitRequirements(
  scenario: ProjectScenario,
  state: SimulationState,
  writing: unknown,
  evaluator: ProjectEvaluator,
): Promise<ProjectStep> {
  requireStage(state, "requirements", "The requirements are already written.");
  const text = cleanText(writing, MAX_WRITING, "requirements");
  const items = itemsFor(scenario.requirements, trackOf(state));
  const result = await evaluator.checklist({ items, text });
  const covered = validIds(result.covered, items.map((item) => item.id));
  const memo: ProjectMemo = { ...memoOf(state), requirements: { text, covered, grader: result.grader } };
  const metricItem = scenario.requirements.find((item) => item.competency === "diligence");
  const action =
    metricItem && covered.includes(metricItem.id)
      ? "requirements-metric"
      : "requirements-plain";
  return system(scenario, withMemo(state, memo), action);
}

export function pickVariant(
  scenario: ProjectScenario,
  covered: string[],
): { variant: string; action: string } {
  const rule = scenario.variantRules.find((item) => !covered.includes(item.missing));
  return rule ? { variant: rule.variant, action: rule.action } : scenario.defaultVariant;
}

export async function submitBrief(
  scenario: ProjectScenario,
  state: SimulationState,
  writing: unknown,
  evaluator: ProjectEvaluator,
): Promise<ProjectStep> {
  requireStage(state, "brief", `${scenario.assistant.name} already has your brief.`);
  const text = cleanText(writing, MAX_WRITING, "brief");
  const track = trackOf(state);
  const items = itemsFor(scenario.brief, track);
  const result = await evaluator.checklist({ items, text });
  const covered = validIds(result.covered, items.map((item) => item.id));
  const { variant, action } = pickVariant(scenario, covered);
  const memo: ProjectMemo = { ...memoOf(state), brief: { text, covered, variant, grader: result.grader } };
  const first = system(scenario, withMemo(state, memo), action);
  const testItem = items.find((item) => item.competency === "diligence");
  const second = system(
    scenario,
    first.state,
    testItem && covered.includes(testItem.id) ? "with-test" : "without-test",
  );
  return { state: second.state, events: [...first.events, ...second.events] };
}

export function currentVariant(
  scenario: ProjectScenario,
  state: SimulationState,
): CodeVariant | null {
  const id = state.variables.variant;
  return scenario.variants.find((variant) => variant.id === id) ?? null;
}

export function requestChanges(
  scenario: ProjectScenario,
  state: SimulationState,
  input: { reasonId?: unknown; path?: unknown; line?: unknown },
): ProjectStep {
  requireStage(state, "review", "There's nothing to review right now.");
  const variant = currentVariant(scenario, state);
  if (!variant) throw new SimulationError(`${scenario.assistant.name} hasn't delivered anything yet.`, 409);
  // A version has at most one problem: once it's fixed, there is nothing left to send back for.
  if (memoOf(state).reviews.some((review) => review.correct)) {
    throw new SimulationError(`${scenario.assistant.name} has already fixed what you found. Approve the work when you're ready.`, 409);
  }
  const track = trackOf(state);
  let correct = false;
  const review: ProjectMemo["reviews"][number] = { variant: variant.id, correct };
  if (track === "engineering") {
    const path = typeof input.path === "string" ? input.path : "";
    const line = typeof input.line === "number" ? input.line : NaN;
    const file = variant.files.find((item) => item.path === path);
    if (!file || !Number.isInteger(line) || line < 1 || line > file.lines.length) {
      throw new SimulationError("Pick the line in the pull request that you want changed.");
    }
    correct = variant.problemLines.some((item) => item.path === path && item.line === line);
    Object.assign(review, { path, line });
  } else {
    const reasonId = typeof input.reasonId === "string" ? input.reasonId : "";
    if (!scenario.reviewReasons.some((reason) => reason.id === reasonId)) {
      throw new SimulationError("Choose why you're sending it back.");
    }
    correct = variant.problemReason !== null && variant.problemReason === reasonId;
    review.reasonId = reasonId;
  }
  review.correct = correct;
  const memo = memoOf(state);
  const next = withMemo(state, { ...memo, reviews: [...memo.reviews, review] });
  return system(scenario, next, correct ? "changes-fixed" : "changes-wrong");
}

/**
 * What the learner's note has to say about a concept: what goes wrong with the
 * flawed version, and the idea that explains it.
 */
export function explanationItems(scenario: ProjectScenario, concept: ProjectConcept): ChecklistItem[] {
  const variant = scenario.variants.find((item) => item.id === concept.variant);
  const symptom = scenario.reviewReasons.find((reason) => reason.id === variant?.problemReason)?.label ?? concept.inTheJob;
  const nameCues = normalise(concept.name).trim().split(" ").filter((word) => word.length >= 4).map((word) => word.slice(0, 5));
  return [
    { id: "what", label: `Says what goes wrong with this version, in any words: ${symptom}`, competency: "discernment", cues: [concept.cues] },
    { id: "why", label: `Explains why, with the idea of ${concept.name}. The belief "${concept.misconception}" is wrong.`, competency: "discernment", cues: [nameCues] },
  ];
}

/**
 * Sending the work back, with a note on why. When the note catches a flaw that
 * comes from a concept, it is graded on what goes wrong and why. The grade only
 * shapes the feedback and the report; what happens next stays scripted.
 */
export async function sendBack(
  scenario: ProjectScenario,
  state: SimulationState,
  input: { reasonId?: unknown; path?: unknown; line?: unknown; explanation?: unknown },
  evaluator: ProjectEvaluator,
): Promise<ProjectStep> {
  const written = typeof input.explanation === "string" ? input.explanation.trim() : "";
  if (written.length > MAX_EXPLANATION) {
    throw new SimulationError(`Keep your note under ${MAX_EXPLANATION} characters.`);
  }
  const step = requestChanges(scenario, state, input);
  if (!written) return step;
  const memo = memoOf(step.state);
  const review = memo.reviews[memo.reviews.length - 1];
  const concept = review.correct ? scenario.concepts?.find((item) => item.variant === review.variant) : undefined;
  let explanation: NonNullable<typeof review.explanation> = { text: written, covered: [] };
  if (concept) {
    const items = explanationItems(scenario, concept);
    const result = await evaluator.checklist({ items, text: written });
    explanation = { text: written, concept: concept.id, covered: validIds(result.covered, items.map((item) => item.id)), grader: result.grader };
  }
  const reviews = [...memo.reviews.slice(0, -1), { ...review, explanation }];
  return { ...step, state: withMemo(step.state, { ...memo, reviews }) };
}

/** Scripted feedback on a graded note. */
function explanationFeedback(scenario: ProjectScenario, concept: ProjectConcept, covered: string[]) {
  const agent = scenario.assistant.name;
  const what = covered.includes("what");
  const why = covered.includes("why");
  const idea = concept.name.toLowerCase();
  if (what && why) return { rating: "strong" as const, text: `You said what goes wrong and why: that's ${idea}. ${agent} knows why it was wrong, not just what to change.` };
  if (what) return { rating: "mixed" as const, text: `You said what goes wrong, but not why it happens. The idea behind it is ${idea}: the report explains it at the end.` };
  if (why) return { rating: "mixed" as const, text: `You explained why it happens (${idea}), but not what it breaks in this job.` };
  return { rating: "weak" as const, text: `Your note didn't say why it was wrong. The idea behind it is ${idea}: the report explains it at the end.` };
}

// ---------------------------------------------------------------------------
// Public view. Hidden variables, checklists, variant ids and rules stay here.

export type ProjectCard = {
  competency: Competency;
  title: string;
  rating: "strong" | "mixed" | "weak";
  evidence: string[];
};

export type ProjectView = {
  scenario: {
    id: string;
    title: string;
    summary: string;
    client: ProjectScenario["client"];
    assistant: ProjectScenario["assistant"];
    cast: ProjectScenario["cast"];
    words: ProjectScenario["words"];
    followUps: ProjectScenario["followUps"] | null;
  };
  status: SimulationState["status"];
  track: Track | null;
  stage: { id: string; kind: StageKind; title: string; narrative: string };
  meters: { trust: number; effort: number; effortMax: number };
  inbox: ProjectScenario["inbox"];
  interview: {
    opening: string;
    turns: InterviewTurn[];
    asked: number;
    min: number;
    max: number;
  };
  notes: string[];
  /** How many concepts the job teaches. They are named and explained in the report, after the release. */
  conceptCount: number;
  requirements: { text: string; coveredCount: number; total: number } | null;
  brief: { text: string } | null;
  work: {
    prTitle: string;
    prSummary: string;
    files: CodeVariant["files"];
    checks: CodeVariant["checks"];
    demo: CodeVariant["demo"];
    reasons: ProjectScenario["reviewReasons"];
    reviews: {
      label: string;
      correct: boolean;
      /** Feedback on the learner's note, when it explained a concept's flaw. */
      explained?: { concept: string; rating: ProjectCard["rating"]; feedback: string };
    }[];
  } | null;
  actions: { id: string; label: string; description?: string }[];
  history: {
    step: number;
    stageId: string;
    actionLabel: string;
    feedback: string;
    /** Only set for choices the learner made. System action ids would reveal variants. */
    choice?: string;
  }[];
  completion: {
    outcome: SimulationOutcome;
    summary: string;
    debrief: string;
    cards: ProjectCard[];
    /** The concepts the job taught, and how the learner did with each. Empty without concepts. */
    concepts: ConceptResult[];
    /** Every change to client trust, in order, with the reason the client saw. */
    trust: { start: number; changes: { delta: number; reason: string }[] };
  } | null;
};

const SHOWN_FROM_REVIEW = new Set(["review", "release"]);

function rating(score: number, max: number): ProjectCard["rating"] {
  if (score >= max) return "strong";
  return score > 0 ? "mixed" : "weak";
}

export function projectCards(
  scenario: ProjectScenario,
  state: SimulationState,
  history: SimulationHistory,
): ProjectCard[] {
  const memo = memoOf(state);
  const track = trackOf(state);
  const chosen = (id: string) => history.some((event) => event.actionId === id);
  const agent = scenario.assistant.name;
  const briefCovered = memo.brief?.covered ?? [];
  const reqCovered = memo.requirements?.covered ?? [];

  // Delegation: what you found out first, and what you kept the assistant away from.
  const delegation: string[] = [];
  let delegationScore = 0;
  if (chosen("call-grace")) {
    delegationScore++;
    delegation.push(`You talked to the client before handing anything to ${agent}.`);
  } else if (chosen("cody-starts")) {
    delegation.push(`You asked ${agent} to build before anyone knew what to build. Two days were thrown away.`);
  } else {
    delegation.push("You replied with a quote for what the client asked for, without checking what she needed.");
  }
  if (briefCovered.includes("C3")) {
    delegationScore++;
    delegation.push(scenario.reportNotes.scopeKept);
  } else {
    delegation.push(scenario.debriefNotes.missedConstraint.C3);
  }

  // Description: questions, requirements and brief.
  const description: string[] = [];
  const keyFacts = Object.keys(scenario.debriefNotes.missedFact);
  const found = memo.interview.revealed;
  description.push(
    `You uncovered ${found.length} of ${scenario.facts.length} facts in the call with ${scenario.client.name}.`,
  );
  for (const fact of keyFacts) {
    if (!found.includes(fact)) description.push(scenario.debriefNotes.missedFact[fact]);
  }
  for (const item of scenario.requirements) {
    if (item.competency === "description" && !reqCovered.includes(item.id)) {
      description.push(scenario.debriefNotes.missedRequirement[item.id] ?? `Missing: ${item.label}`);
    }
  }
  for (const id of ["C1", "C2"]) {
    if (!briefCovered.includes(id)) description.push(scenario.debriefNotes.missedConstraint[id]);
  }
  const descriptionScore =
    keyFacts.filter((fact) => found.includes(fact)).length +
    ["C1", "C2"].filter((id) => briefCovered.includes(id)).length;
  if (description.length === 1) {
    description.push("Your requirements and brief covered every constraint that mattered.");
  }

  // Discernment: what you approved.
  const discernment: string[] = [];
  const first = memo.brief?.variant ?? "none";
  const shipped = String(state.variables.variant);
  const wrongRequests = memo.reviews.filter((review) => !review.correct).length;
  const fixed = memo.reviews.some((review) => review.correct);
  let discernmentScore = 0;
  if (first === "good") {
    discernmentScore = wrongRequests ? 1 : 2;
    discernment.push(`${agent}'s first delivery was correct, and you approved it.`);
  } else if (fixed && shipped === "good") {
    discernmentScore = 2;
    discernment.push(`You spotted what was wrong with ${agent}'s work and sent it back for the right reason.`);
  } else {
    discernment.push(
      track === "engineering"
        ? "You approved a pull request with a problem in it. The diff and the checks showed it."
        : "You approved work with a problem in it. The walkthrough showed it.",
    );
  }
  if (wrongRequests) {
    discernment.push(
      `${wrongRequests} change request${wrongRequests === 1 ? "" : "s"} named the wrong problem and cost time.`,
    );
  }

  // Diligence: success measure, test and release.
  const diligence: string[] = [];
  let diligenceScore = 0;
  if (reqCovered.includes("R4")) {
    diligenceScore++;
    diligence.push("Your requirements included a success measure the client agreed with.");
  } else {
    diligence.push(scenario.debriefNotes.missedRequirement.R4);
  }
  if (track === "engineering") {
    if (briefCovered.includes("C4")) {
      diligence.push(scenario.reportNotes.testAsked ?? `You asked ${agent} for a test.`);
    } else {
      diligence.push(scenario.debriefNotes.missedConstraint.C4);
    }
  }
  const release = state.variables.release;
  if (release === "measured") {
    diligenceScore++;
    diligence.push("You released with a weekly count against the target.");
  } else if (release === "pilot") {
    diligenceScore++;
    diligence.push(scenario.reportNotes.pilot);
  } else if (release === "plain") {
    diligence.push("You switched everyone over at once with no way to tell whether it worked.");
  }

  return [
    { competency: "delegation", title: "Delegation", rating: rating(delegationScore, 2), evidence: delegation },
    { competency: "description", title: "Description", rating: rating(descriptionScore, keyFacts.length + 2), evidence: description },
    { competency: "discernment", title: "Discernment", rating: rating(discernmentScore, 2), evidence: discernment },
    { competency: "diligence", title: "Diligence", rating: rating(diligenceScore, 2), evidence: diligence },
  ];
}

/** What became of one concept in the run: found, prevented, caught or missed, and the note on it. */
export type ConceptResult = {
  name: string;
  /** The learner uncovered its fact on the call. */
  found: boolean;
  outcome: "prevented" | "caught" | "shipped" | "left-out" | "not-reached";
  rating: ProjectCard["rating"];
  summary: string;
  misconception: string;
  /** What the idea means, and an analogy, shown in the report. */
  explanation: string;
  bridge: string;
  note?: { text: string; rating: ProjectCard["rating"]; feedback: string };
};

export function conceptResults(scenario: ProjectScenario, state: SimulationState): ConceptResult[] {
  const memo = memoOf(state);
  const agent = scenario.assistant.name;
  return (scenario.concepts ?? []).map((concept) => {
    const found = memo.interview.revealed.includes(concept.fact);
    const constraint = scenario.variantRules.find((rule) => rule.variant === concept.variant)?.missing;
    const review = memo.reviews.find((item) => item.correct && item.variant === concept.variant);
    const explanation = memo.reviews.find((item) => item.explanation?.concept === concept.id)?.explanation;
    const feedback = explanation ? explanationFeedback(scenario, concept, explanation.covered) : null;
    const note = explanation && feedback ? { text: explanation.text, rating: feedback.rating, feedback: feedback.text } : undefined;
    const base = { name: concept.name, found, misconception: concept.misconception, explanation: concept.explanation, bridge: concept.bridge };

    if (!memo.brief) {
      return { ...base, outcome: "not-reached", rating: "weak", summary: "The job ended before the work got this far." };
    }
    if (constraint && memo.brief.covered.includes(constraint)) {
      return { ...base, outcome: "prevented", rating: "strong", summary: `Your brief covered it, so ${agent} never made the classic mistake.` };
    }
    if (review) {
      return {
        ...base,
        outcome: "caught",
        rating: note?.rating === "strong" ? "strong" : "mixed",
        summary: `${agent} made the classic mistake, and you sent it back for the right reason.`,
        ...(note ? { note } : {}),
      };
    }
    if (state.variables.variant === concept.variant) {
      return { ...base, outcome: "shipped", rating: "weak", summary: `${agent} made the classic mistake, and it was still in the work at the end.` };
    }
    return {
      ...base,
      outcome: "left-out",
      rating: "mixed",
      summary: `Your brief left it out. The work ended up right only because ${agent} redid it, not because anyone checked.`,
    };
  });
}

/** Trust changes from the run's history, plus the outcome's change at the end. */
function trustChanges(scenario: ProjectScenario, history: SimulationHistory, memo: ProjectMemo) {
  const variable = scenario.config.variables.find((item) => item.id === "trust");
  const changes: { delta: number; reason: string }[] = [];
  for (const event of history) {
    for (const change of event.changes) {
      if (change.variable !== "trust") continue;
      const delta = Number(change.to) - Number(change.from);
      if (delta) changes.push({ delta, reason: scenario.trust.reasons[event.actionId] ?? event.actionLabel });
    }
  }
  if (memo.outcomeTrust?.delta) changes.push(memo.outcomeTrust);
  return { start: Number(variable?.initial ?? 0), changes };
}

export function projectView(
  scenario: ProjectScenario,
  state: SimulationState,
  history: SimulationHistory,
): ProjectView {
  const memo = memoOf(state);
  const track = trackOf(state);
  const kind = stageKind(scenario, state);
  const stage = scenario.config.stages.find((item) => item.id === state.stageId);
  if (!stage) throw new SimulationError("The project stage is missing.", 500);
  const narrative =
    (track && scenario.trackNarratives?.[stage.id]?.[track]) ?? stage.narrative;
  const variant = currentVariant(scenario, state);
  const showWork = variant && (SHOWN_FROM_REVIEW.has(state.stageId) || state.status === "completed");
  const reasonLabel = (id?: string) =>
    scenario.reviewReasons.find((reason) => reason.id === id)?.label;
  const effortVar = scenario.config.variables.find((item) => item.id === "effort");
  const learnerActionIds = new Set(
    scenario.config.stages.flatMap((item) =>
      item.actions.filter((action) => action.trigger !== "system").map((action) => action.id),
    ),
  );

  return {
    scenario: {
      id: scenario.id,
      title: scenario.title,
      summary: scenario.summary,
      client: scenario.client,
      assistant: scenario.assistant,
      cast: scenario.cast,
      words: scenario.words,
      followUps: scenario.followUps ?? null,
    },
    status: state.status,
    track,
    stage: { id: stage.id, kind, title: stage.title, narrative },
    meters: {
      trust: Number(state.variables.trust ?? 0),
      effort: Number(state.variables.effort ?? 0),
      effortMax: effortVar && effortVar.type === "number" ? effortVar.max : 10,
    },
    inbox: scenario.inbox,
    interview: {
      opening: scenario.interview.opening,
      // Graders are kept for the teacher, not shown to the learner.
      turns: memo.interview.turns.map(({ role, text }) => ({ role, text })),
      asked: memo.interview.turns.filter((turn) => turn.role === "learner").length,
      min: scenario.interview.minQuestions,
      max: scenario.interview.maxQuestions,
    },
    notes: scenario.facts
      .filter((fact) => memo.interview.revealed.includes(fact.id))
      .map((fact) => fact.text),
    conceptCount: scenario.concepts?.length ?? 0,
    // Which points were covered stays hidden until the debrief, so the brief and
    // review still test the learner's own judgement.
    requirements: memo.requirements
      ? {
          text: memo.requirements.text,
          coveredCount: memo.requirements.covered.length,
          total: itemsFor(scenario.requirements, track).length,
        }
      : null,
    brief: memo.brief ? { text: memo.brief.text } : null,
    work: showWork
      ? {
          prTitle: variant.prTitle,
          prSummary: variant.prSummary,
          files:
            track !== "engineering"
              ? []
              : state.variables.hasTest === true && scenario.testFile
                ? [...variant.files, scenario.testFile]
                : variant.files,
          checks: track === "engineering" && state.variables.hasTest === true ? variant.checks : [],
          demo: track === "product" ? variant.demo : [],
          reasons: track === "product" ? scenario.reviewReasons : [],
          reviews: memo.reviews.map((review) => {
            const concept = scenario.concepts?.find((item) => item.id === review.explanation?.concept);
            const feedback = concept && review.explanation ? explanationFeedback(scenario, concept, review.explanation.covered) : null;
            return {
              label:
                track === "engineering"
                  ? `${review.path}, line ${review.line}`
                  : (reasonLabel(review.reasonId) ?? "Request changes"),
              correct: review.correct,
              ...(concept && feedback ? { explained: { concept: concept.name, rating: feedback.rating, feedback: feedback.text } } : {}),
            };
          }),
        }
      : null,
    actions:
      state.status === "completed"
        ? []
        : availableActions(scenario.config, state).map((action) => ({
            id: action.id,
            label: action.label,
            description: action.description,
          })),
    history: history.map((event) => {
      const learnerChoice = learnerActionIds.has(event.actionId);
      return {
        step: event.step,
        stageId: event.stageId,
        actionLabel: event.actionLabel,
        feedback: event.feedback,
        ...(learnerChoice ? { choice: event.actionId } : {}),
      };
    }),
    completion:
      state.status === "completed" && state.outcome
        ? {
            outcome: state.outcome,
            summary: state.summary ?? scenario.config.debrief[state.outcome],
            debrief: scenario.config.debrief[state.outcome],
            cards: projectCards(scenario, state, history),
            concepts: conceptResults(scenario, state),
            trust: trustChanges(scenario, history, memo),
          }
        : null,
  };
}
