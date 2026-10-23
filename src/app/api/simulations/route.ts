import { z } from "zod";
import {
  HttpError,
  recordDb,
  requireAccount,
} from "@/lib/supabase/server";
import { readLesson } from "@/lib/learning/repository";
import { isDatabaseCourseId } from "@/lib/learning/ids";
import {
  sameActivityContent,
  validateActivity,
  type LearningActivity,
  type LearningFeedback,
} from "@/lib/learning/registry";
import {
  applySimulationAction,
  simulationView,
  startSimulation,
  type SimulationHistory,
  type SimulationState,
} from "@/lib/learning/simulation/engine";
import {
  deterministicSimulationFeedback,
  outcomeScore,
  simulationFeedback,
} from "@/lib/learning/simulation/evaluate";
import { simulationApiError } from "@/lib/learning/simulation/http";
import type { SimulationOutcome } from "@/lib/learning/simulation/schema";

const requestSchema = z.object({
  courseId: z.string().trim().min(1).max(80),
  lessonId: z.string().trim().min(1).max(300),
  activityId: z.string().trim().min(1).max(120),
  action: z.enum(["start", "choose", "restart"]),
  choiceId: z.string().trim().min(1).max(120).optional(),
});

type SimulationActivity = Extract<LearningActivity, { activityType: "simulation" }>;

type SessionRow = {
  id: string;
  run_id: string;
  user_id: string;
  course_id: string;
  lesson_id: string;
  activity_id: string;
  course_revision: number;
  activity_snapshot: unknown;
  state: unknown;
  history: unknown;
  step_count: number;
  status: "active" | "completed";
  outcome: SimulationOutcome | null;
  version: number;
};

function isSimulation(block: unknown): block is SimulationActivity {
  const parsed = validateActivity(block);
  return parsed.success && parsed.data.activityType === "simulation";
}

async function setup(
  courseId: string,
  lessonId: string,
  activityId: string,
) {
  const account = await requireAccount();
  const found = await readLesson(courseId, lessonId);
  if (!found) {
    throw new HttpError(404, "Lesson unavailable or you do not have access.");
  }
  const block = found.lesson.blocks.find((item) => item.id === activityId);
  if (!isSimulation(block)) {
    throw new HttpError(404, "Simulation activity not found.");
  }
  const databaseCourse = isDatabaseCourseId(courseId);
  let revision = 0;
  if (databaseCourse) {
    const { data, error } = await account.db
      .from("courses")
      .select("revision")
      .eq("id", courseId)
      .single();
    if (error || !data) throw new HttpError(404, "Course unavailable.");
    revision = data.revision as number;
  }
  return {
    account,
    course: found.course,
    block,
    databaseCourse,
    revision,
  };
}

async function readSession(
  userId: string,
  courseId: string,
  lessonId: string,
  activityId: string,
): Promise<SessionRow | null> {
  const writer = recordDb();
  const { data, error } = await writer
    .from("simulation_sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .eq("lesson_id", lessonId)
    .eq("activity_id", activityId)
    .maybeSingle();
  if (error) throw new HttpError(503, "Could not load the simulation state.");
  return (data as SessionRow | null) ?? null;
}

function stateOf(session: SessionRow): SimulationState {
  const state = session.state as SimulationState;
  if (
    !state ||
    typeof state !== "object" ||
    typeof state.stageId !== "string" ||
    typeof state.step !== "number" ||
    !state.variables ||
    typeof state.variables !== "object"
  ) {
    throw new HttpError(409, "This simulation state is unreadable. Restart it.");
  }
  return state;
}

function historyOf(session: SessionRow): SimulationHistory {
  return Array.isArray(session.history)
    ? (session.history as SimulationHistory)
    : [];
}

function changedActivity(): never {
  throw new HttpError(
    409,
    "This activity changed since the simulation started. Restart to use the updated version.",
  );
}

function snapshotMatches(session: SessionRow, block: SimulationActivity): boolean {
  return sameActivityContent(session.activity_snapshot, block);
}

async function createSession(
  userId: string,
  courseId: string,
  lessonId: string,
  block: SimulationActivity,
  revision: number,
): Promise<SessionRow> {
  const state = startSimulation(block.config);
  const writer = recordDb();
  const { data, error } = await writer
    .from("simulation_sessions")
    .insert({
      id: crypto.randomUUID(),
      run_id: crypto.randomUUID(),
      user_id: userId,
      course_id: courseId,
      lesson_id: lessonId,
      activity_id: block.id,
      course_revision: revision,
      activity_snapshot: block,
      state,
      history: [],
      step_count: 0,
      status: "active",
      outcome: null,
      version: 1,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) {
    // A concurrent start won the unique key; return that session instead.
    if ((error as { code?: string }).code === "23505") {
      const existing = await readSession(userId, courseId, lessonId, block.id);
      if (existing) return existing;
    }
    throw new HttpError(503, "Could not start the simulation. Please retry.");
  }
  return data as SessionRow;
}

function attemptResponse(
  session: SessionRow,
  history: SimulationHistory,
): string {
  return JSON.stringify({
    outcome: session.outcome,
    steps: history.map((event) => ({
      step: event.step,
      stageId: event.stageId,
      actionId: event.actionId,
      actionLabel: event.actionLabel,
      changes: event.changes,
    })),
  });
}

async function recordAttempt(
  session: SessionRow,
  block: SimulationActivity,
  feedback: LearningFeedback,
) {
  const writer = recordDb();
  const { error } = await writer.from("learning_attempts").upsert(
    {
      id: session.run_id,
      user_id: session.user_id,
      course_id: session.course_id,
      lesson_id: session.lesson_id,
      activity_id: session.activity_id,
      course_revision: session.course_revision,
      activity_snapshot: block,
      response: attemptResponse(session, historyOf(session)),
      feedback,
      score: session.outcome ? outcomeScore(session.outcome) : null,
    },
    { onConflict: "id", ignoreDuplicates: true },
  );
  if (error) {
    console.error("Could not record simulation attempt", error);
    throw new HttpError(503, "The result could not be saved. Please retry.");
  }
}

async function storedFeedback(runId: string): Promise<LearningFeedback | null> {
  const { data, error } = await recordDb()
    .from("learning_attempts")
    .select("feedback")
    .eq("id", runId)
    .maybeSingle();
  if (error) return null;
  return (data?.feedback as LearningFeedback | null) ?? null;
}

async function completedResponse(
  session: SessionRow,
  block: SimulationActivity,
  databaseCourse: boolean,
  feedback?: LearningFeedback,
) {
  const shown =
    feedback ??
    (databaseCourse ? await storedFeedback(session.run_id) : null) ??
    deterministicSimulationFeedback(
      block.config,
      stateOf(session),
      historyOf(session),
    );
  // Persist before reporting saved. A failed insert throws, so a later GET can
  // retry this function instead of trusting the completed session flag alone.
  let saved = false;
  if (databaseCourse && session.outcome) {
    await recordAttempt(session, block, shown);
    saved = true;
  }
  return Response.json({
    session: simulationView(block.config, stateOf(session), historyOf(session)),
    feedback: shown,
    saved,
  });
}

export async function GET(req: Request) {
  try {
    const params = new URL(req.url).searchParams;
    const courseId = z.string().trim().min(1).max(80).parse(params.get("courseId"));
    const lessonId = z.string().trim().min(1).max(300).parse(params.get("lessonId"));
    const activityId = z.string().trim().min(1).max(120).parse(params.get("activityId"));
    const { account, block, databaseCourse } = await setup(
      courseId,
      lessonId,
      activityId,
    );
    const session = await readSession(account.user.id, courseId, lessonId, activityId);
    if (!session) return Response.json({ session: null });
    if (!snapshotMatches(session, block)) changedActivity();
    if (session.status === "completed") {
      return completedResponse(session, block, databaseCourse);
    }
    const view = simulationView(block.config, stateOf(session), historyOf(session));
    return Response.json({ session: view, saved: true });
  } catch (error) {
    return simulationApiError(error);
  }
}

export async function POST(req: Request) {
  try {
    const body = requestSchema.parse(await req.json().catch(() => null));
    const { account, course, block, databaseCourse, revision } = await setup(
      body.courseId,
      body.lessonId,
      body.activityId,
    );
    const writer = recordDb();

    if (body.action === "start") {
      const existing = await readSession(
        account.user.id,
        body.courseId,
        body.lessonId,
        block.id,
      );
      if (existing) {
        if (!snapshotMatches(existing, block)) changedActivity();
        if (existing.status === "completed") {
          return completedResponse(existing, block, databaseCourse);
        }
        return Response.json({
          session: simulationView(
            block.config,
            stateOf(existing),
            historyOf(existing),
          ),
          saved: true,
        });
      }
      const created = await createSession(
        account.user.id,
        body.courseId,
        body.lessonId,
        block,
        revision,
      );
      return Response.json({
        session: simulationView(block.config, stateOf(created), []),
        saved: true,
      });
    }

    if (body.action === "restart") {
      const state = startSimulation(block.config);
      const existing = await readSession(
        account.user.id,
        body.courseId,
        body.lessonId,
        block.id,
      );
      if (!existing) {
        const created = await createSession(
          account.user.id,
          body.courseId,
          body.lessonId,
          block,
          revision,
        );
        return Response.json({
          session: simulationView(block.config, stateOf(created), []),
          saved: true,
        });
      }
      const { data, error } = await writer
        .from("simulation_sessions")
        .update({
          run_id: crypto.randomUUID(),
          course_revision: revision,
          activity_snapshot: block,
          state,
          history: [],
          step_count: 0,
          status: "active",
          outcome: null,
          version: existing.version + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .eq("version", existing.version)
        .select("*")
        .single();
      if (error || !data) {
        throw new HttpError(
          409,
          "This simulation was updated in another tab. Reload the page and try again.",
        );
      }
      return Response.json({
        session: simulationView(block.config, stateOf(data as SessionRow), []),
        saved: true,
      });
    }

    if (!body.choiceId) {
      throw new HttpError(400, "Choose an action first.");
    }
    const session = await readSession(
      account.user.id,
      body.courseId,
      body.lessonId,
      block.id,
    );
    if (!session) {
      throw new HttpError(409, "Start the simulation before choosing an action.");
    }
    if (!snapshotMatches(session, block)) changedActivity();
    if (session.status === "completed") {
      // Duplicate submission or a reload after completion: return the stored
      // result instead of applying the action twice.
      return completedResponse(session, block, databaseCourse);
    }

    const current = stateOf(session);
    const result = applySimulationAction(block.config, current, body.choiceId);
    const history: SimulationHistory = [...historyOf(session), result.event];
    const next = result.state;

    const { data, error } = await writer
      .from("simulation_sessions")
      .update({
        course_revision: revision,
        activity_snapshot: block,
        state: next,
        history,
        step_count: next.step,
        status: next.status,
        outcome: next.outcome,
        version: session.version + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", session.id)
      .eq("version", session.version)
      .select("*")
      .single();
    if (error || !data) {
      throw new HttpError(
        409,
        "This simulation was updated in another tab. Reload the page and try again.",
      );
    }
    const saved = data as SessionRow;
    if (next.status === "completed") {
      let feedback: LearningFeedback | undefined;
      if (process.env.GEMINI_API_KEY) {
        // AI is an enhancement only. Quota failures and model errors fall back
        // to the deterministic debrief below.
        let allowed = false;
        try {
          const { enforceQuota } = await import("@/lib/ai/quota");
          await enforceQuota(account.db, account.user.id, "feedback");
          allowed = true;
        } catch {
          allowed = false;
        }
        if (allowed) {
          feedback = await simulationFeedback(
            block.config,
            next,
            history,
            course.language,
          );
        }
      }
      return completedResponse(saved, block, databaseCourse, feedback);
    }
    return Response.json({
      session: simulationView(block.config, next, history),
      saved: true,
    });
  } catch (error) {
    return simulationApiError(error);
  }
}
