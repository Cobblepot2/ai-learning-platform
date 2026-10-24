import { z } from "zod";
import { HttpError, recordDb, requireAccount } from "@/lib/supabase/server";
import { simulationApiError } from "@/lib/learning/simulation/http";
import type {
  SimulationHistory,
  SimulationState,
} from "@/lib/learning/simulation/engine";
import { getProjectScenario } from "@/lib/projects";
import { offlineEvaluator } from "@/lib/projects/evaluate";
import {
  askClient,
  chooseAction,
  endInterview,
  projectView,
  requestChanges,
  startProject,
  submitBrief,
  submitRequirements,
  type ProjectStep,
} from "@/lib/projects/runtime";
import type { ProjectScenario } from "@/lib/projects/types";

/*
 * Project runs reuse the simulation_sessions table: one row per learner and
 * scenario. The browser only ever sends what the learner did (a choice id, a
 * question, a piece of writing); state, variants and outcomes stay on the server.
 */

const LESSON_ID = "run";

const bodySchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("start") }),
  z.object({ op: z.literal("restart") }),
  z.object({ op: z.literal("choose"), actionId: z.string().trim().min(1).max(120) }),
  z.object({ op: z.literal("ask"), question: z.string().max(2000) }),
  z.object({ op: z.literal("end-interview") }),
  z.object({ op: z.literal("requirements"), text: z.string().max(10000) }),
  z.object({ op: z.literal("brief"), text: z.string().max(10000) }),
  z.object({
    op: z.literal("request-changes"),
    reasonId: z.string().max(120).optional(),
    path: z.string().max(300).optional(),
    line: z.number().int().optional(),
  }),
]);

type SessionRow = {
  id: string;
  run_id: string;
  activity_snapshot: unknown;
  state: unknown;
  history: unknown;
  version: number;
};

function courseKey(scenario: ProjectScenario) {
  return `project:${scenario.id}`;
}

function snapshot(scenario: ProjectScenario) {
  return { project: scenario.id, version: scenario.version };
}

function sameVersion(session: SessionRow, scenario: ProjectScenario) {
  const value = session.activity_snapshot as { project?: unknown; version?: unknown } | null;
  return value?.project === scenario.id && value?.version === scenario.version;
}

async function scenarioFrom(params: Promise<{ scenarioId: string }>) {
  const { scenarioId } = await params;
  const scenario = getProjectScenario(scenarioId);
  if (!scenario) throw new HttpError(404, "Project not found.");
  return scenario;
}

async function readSession(userId: string, scenario: ProjectScenario) {
  const { data, error } = await recordDb()
    .from("simulation_sessions")
    .select("id,run_id,activity_snapshot,state,history,version")
    .eq("user_id", userId)
    .eq("course_id", courseKey(scenario))
    .eq("lesson_id", LESSON_ID)
    .eq("activity_id", scenario.id)
    .maybeSingle();
  if (error) throw new HttpError(503, "Could not load your project. Please retry.");
  return (data as SessionRow | null) ?? null;
}

function stateOf(session: SessionRow): SimulationState {
  const state = session.state as SimulationState | null;
  if (!state || typeof state.stageId !== "string" || !state.variables || !state.memo) {
    throw new HttpError(409, "This project run is unreadable. Restart it.");
  }
  return state;
}

function historyOf(session: SessionRow): SimulationHistory {
  return Array.isArray(session.history) ? (session.history as SimulationHistory) : [];
}

function fresh(scenario: ProjectScenario) {
  const state = startProject(scenario);
  return {
    run_id: crypto.randomUUID(),
    activity_snapshot: snapshot(scenario),
    course_revision: 0,
    state,
    history: [],
    step_count: 0,
    status: "active",
    outcome: null,
    updated_at: new Date().toISOString(),
  };
}

async function createSession(userId: string, scenario: ProjectScenario): Promise<SessionRow> {
  const { data, error } = await recordDb()
    .from("simulation_sessions")
    .insert({
      id: crypto.randomUUID(),
      user_id: userId,
      course_id: courseKey(scenario),
      lesson_id: LESSON_ID,
      activity_id: scenario.id,
      version: 1,
      ...fresh(scenario),
    })
    .select("id,run_id,activity_snapshot,state,history,version")
    .single();
  if (error) {
    // A second tab started at the same moment and won the unique key.
    if ((error as { code?: string }).code === "23505") {
      const existing = await readSession(userId, scenario);
      if (existing) return existing;
    }
    throw new HttpError(503, "Could not start the project. Please retry.");
  }
  return data as SessionRow;
}

async function save(
  session: SessionRow,
  patch: Record<string, unknown>,
): Promise<SessionRow> {
  const { data, error } = await recordDb()
    .from("simulation_sessions")
    .update({ ...patch, version: session.version + 1, updated_at: new Date().toISOString() })
    .eq("id", session.id)
    .eq("version", session.version)
    .select("id,run_id,activity_snapshot,state,history,version")
    .single();
  if (error || !data) {
    throw new HttpError(409, "Your project changed in another tab. Reload the page and try again.");
  }
  return data as SessionRow;
}

function stepPatch(session: SessionRow, step: ProjectStep) {
  return {
    state: step.state,
    history: [...historyOf(session), ...step.events],
    step_count: step.state.step,
    status: step.state.status,
    outcome: step.state.outcome,
  };
}

function viewOf(scenario: ProjectScenario, session: SessionRow) {
  return projectView(scenario, stateOf(session), historyOf(session));
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ scenarioId: string }> },
) {
  try {
    const scenario = await scenarioFrom(params);
    const { user } = await requireAccount();
    const session = await readSession(user.id, scenario);
    if (!session || !sameVersion(session, scenario)) return Response.json({ view: null });
    return Response.json({ view: viewOf(scenario, session) });
  } catch (error) {
    return simulationApiError(error);
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ scenarioId: string }> },
) {
  try {
    const scenario = await scenarioFrom(params);
    const { user } = await requireAccount();
    const body = bodySchema.parse(await req.json().catch(() => null));
    const existing = await readSession(user.id, scenario);

    if (body.op === "start") {
      if (existing && sameVersion(existing, scenario)) {
        return Response.json({ view: viewOf(scenario, existing) });
      }
      // No run yet, or the scenario content changed since this run started.
      const session = existing
        ? await save(existing, fresh(scenario))
        : await createSession(user.id, scenario);
      return Response.json({ view: viewOf(scenario, session) });
    }

    if (body.op === "restart") {
      const session = existing
        ? await save(existing, fresh(scenario))
        : await createSession(user.id, scenario);
      return Response.json({ view: viewOf(scenario, session) });
    }

    if (!existing) throw new HttpError(409, "Start the project first.");
    if (!sameVersion(existing, scenario)) {
      throw new HttpError(409, "This project was updated since you started. Restart to continue.");
    }
    const state = stateOf(existing);
    const evaluator = offlineEvaluator;

    if (body.op === "ask") {
      const result = await askClient(scenario, state, body.question, evaluator);
      const saved = await save(existing, { state: result.state });
      return Response.json({ view: viewOf(scenario, saved), reply: result.reply });
    }

    let step: ProjectStep;
    switch (body.op) {
      case "choose":
        step = chooseAction(scenario, state, body.actionId);
        break;
      case "end-interview":
        step = endInterview(scenario, state);
        break;
      case "requirements":
        step = await submitRequirements(scenario, state, body.text, evaluator);
        break;
      case "brief":
        step = await submitBrief(scenario, state, body.text, evaluator);
        break;
      case "request-changes":
        step = requestChanges(scenario, state, body);
        break;
    }
    const saved = await save(existing, stepPatch(existing, step));
    return Response.json({ view: viewOf(scenario, saved) });
  } catch (error) {
    return simulationApiError(error);
  }
}
