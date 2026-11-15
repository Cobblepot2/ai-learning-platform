import { randomInt } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SimulationState } from "@/lib/learning/simulation/engine";
import { projectListings } from "@/lib/projects/catalog";
import { getProjectScenario } from "@/lib/projects";
import { isGeneratedId, loadGeneratedScenario } from "@/lib/projects/generated/store";
import { conceptResults, trackOf, type ConceptResult } from "@/lib/projects/runtime";
import type { ProjectScenario, Track } from "@/lib/projects/types";
import { HttpError, recordDb, redactSecrets } from "@/lib/supabase/server";

/*
 * An instructor's classes: students join with a code, the instructor assigns
 * built-in projects or their own, and follows each student's runs. Reads and writes go
 * through the instructor's row-level-secured client; students' runs are read
 * with the service role only after that client has shown the class is theirs.
 */

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function newJoinCode() {
  return Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
}

export function isJoinCode(code: string) {
  return /^[A-HJ-NP-Z2-9]{6}$/.test(code);
}

/** Built-in projects an instructor can assign. */
export const ASSIGNABLE = projectListings.map(({ id, title }) => ({ id, title }));

export function isAssignable(id: string) {
  return ASSIGNABLE.some((project) => project.id === id);
}

/** What this instructor can assign: the built-in projects, then the ones they made. */
export async function assignableFor(db: SupabaseClient, ownerId?: string) {
  const unavailable = () => new HttpError(503, "Could not load the complete project list. Your choices are kept. Please retry.");
  if (!ownerId) {
    const { data, error } = await db.auth.getUser();
    if (error || !data.user) throw unavailable();
    ownerId = data.user.id;
  }
  // This is the assignment catalogue, not the 50-item home-page preview.
  // Scope explicitly to the owner even if gallery RLS later permits public rows.
  const own: { id: string; title: string }[] = [];
  let after: string | null = null;
  for (;;) {
    let query = db.from("generated_projects").select("id,title").eq("owner_id", ownerId).order("id").limit(100);
    if (after !== null) query = query.gt("id", after);
    const { data, error } = await query;
    if (error || !data) throw unavailable(); // Never use an empty/partial list after an error.
    if (!data.length) break;
    own.push(...data);
    after = data[data.length - 1].id;
    // Continue even with a short page: the server can cap it below 100 rows.
  }
  return [...ASSIGNABLE, ...own];
}

export type ClassRow = { id: string; name: string; join_code: string; created_at: string };

export async function createClass(db: SupabaseClient, ownerId: string, name: string): Promise<ClassRow> {
  // A clash with another class's code is unlikely; retry a few times if it happens.
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await db
      .from("classes")
      .insert({ owner_id: ownerId, name, join_code: newJoinCode() })
      .select("id,name,join_code,created_at")
      .single();
    if (!error) return data as ClassRow;
    if (error.code !== "23505") {
      console.error("classes insert failed", { code: error.code, message: redactSecrets(error.message) });
      throw new HttpError(error.code === "42501" ? 403 : 503, error.code === "42501" ? "Only instructors can create classes." : "Could not create the class. Please retry.");
    }
  }
  throw new HttpError(503, "Could not create the class. Please retry.");
}

export async function listOwnClasses(db: SupabaseClient, ownerId: string) {
  const { data } = await db
    .from("classes")
    .select("id,name,join_code,created_at,class_members(count)")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });
  return ((data ?? []) as (ClassRow & { class_members: { count: number }[] })[]).map((row) => ({
    ...row,
    students: row.class_members[0]?.count ?? 0,
  }));
}

/** The class, if the signed-in user owns it. Row-level security does the check. */
export async function loadOwnClass(db: SupabaseClient, ownerId: string, classId: string) {
  if (!/^[0-9a-f-]{36}$/.test(classId)) return null;
  // Version and project IDs come from the same database snapshot.
  const { data, error } = await db.from("classes").select("id,name,join_code,created_at,projects_version,class_projects(project_id)").eq("id", classId).eq("owner_id", ownerId).order("assigned_at", { referencedTable: "class_projects" }).maybeSingle();
  if (error) throw new HttpError(503, "Could not load the class. Please retry.");
  if (!data) return null;
  const { data: members, error: membersError } = await db.from("class_members").select("student_id,joined_at").eq("class_id", classId).order("joined_at");
  if (membersError) throw new HttpError(503, "Could not load the class. Please retry.");
  return {
    ...(data as ClassRow),
    projects_version: data.projects_version as number,
    members: (members ?? []) as { student_id: string; joined_at: string }[],
    projects: ((data.class_projects ?? []) as { project_id: string }[]).map((row) => row.project_id).filter((id) => isAssignable(id) || isGeneratedId(id)),
  };
}

/** Replaces the class's assigned projects with those of `projectIds` the instructor may assign. */
export async function assignProjects(db: SupabaseClient, classId: string, projectIds: string[], allowed: string[], expectedVersion: number) {
  const wanted = [...new Set(projectIds)];
  if (wanted.some((id) => !allowed.includes(id))) throw new HttpError(400, "A selected project is no longer available. Reload the class.");
  const { data, error } = await db.rpc("replace_class_projects", { p_class_id: classId, p_expected_version: expectedVersion, p_projects: wanted });
  if (error?.code === "PT409") throw new HttpError(409, "These assignments changed. Reload to review them before saving again.");
  if (error?.code === "42501") throw new HttpError(403, "You can only assign your own projects to your own class.");
  if (error || typeof data !== "number") throw new HttpError(503, "Could not save. Your choices are kept. Please retry.");
  return { projects: wanted, version: data };
}

// ---------------------------------------------------------------------------
// Progress. What a student's run shows the instructor.

export type RunSummary =
  | { status: "not-started" }
  | {
      status: "active" | "completed";
      track: Track | null;
      stage: string;
      outcome: string | null;
      trust: number;
      days: number;
      concepts: ConceptResult[];
      updatedAt: string;
    };

export function summariseRun(
  scenario: ProjectScenario,
  row: { state: SimulationState; status: string; outcome: string | null; updated_at: string } | null,
): RunSummary {
  // Opening the desktop saves a run; it counts once the student has done something.
  if (!row || (row.status !== "completed" && row.state.step === 0)) return { status: "not-started" };
  const state = row.state;
  const stage = scenario.config.stages.find((item) => item.id === state.stageId);
  const completed = row.status === "completed";
  return {
    status: completed ? "completed" : "active",
    track: trackOf(state),
    stage: completed ? "Finished" : (stage?.title ?? state.stageId),
    outcome: completed ? row.outcome : null,
    trust: Number(state.variables.trust ?? 0),
    days: Number(state.variables.effort ?? 0),
    concepts: conceptResults(scenario, state),
    updatedAt: row.updated_at,
  };
}

export type StudentProgress = { id: string; name: string; email: string | null; joinedAt: string; runs: Record<string, RunSummary> };

/**
 * Every member's run of every assigned project. Call only after loadOwnClass
 * has shown that the class belongs to the signed-in instructor.
 */
export async function classProgress(
  ownerId: string,
  members: { student_id: string; joined_at: string }[],
  projectIds: string[],
): Promise<StudentProgress[]> {
  if (!members.length) return [];
  // The instructor's own projects are loaded as their owner.
  const scenarios = new Map<string, ProjectScenario>();
  for (const id of projectIds) {
    const scenario = getProjectScenario(id) ?? (isGeneratedId(id) ? await loadGeneratedScenario(id, ownerId) : null);
    if (scenario) scenarios.set(id, scenario);
  }
  const service = recordDb();
  const ids = members.map((member) => member.student_id);
  const [{ data: sessions, error }, users] = await Promise.all([
    projectIds.length
      ? service
          .from("simulation_sessions")
          .select("user_id,activity_id,state,status,outcome,updated_at")
          .in("user_id", ids)
          .in("course_id", projectIds.map((id) => `project:${id}`))
      : Promise.resolve({ data: [], error: null }),
    Promise.all(ids.map((id) => service.auth.admin.getUserById(id).then(({ data }) => [id, data.user?.email ?? null] as const))),
  ]);
  if (error) throw new HttpError(503, "Could not load the class's progress. Please retry.");
  const emails = new Map(users);
  return members.map((member) => {
    const email = emails.get(member.student_id) ?? null;
    // Names come from the email: the retired onboarding's display names are stale, and nothing sets them now.
    const name = email?.split("@")[0] || "Student";
    const runs: Record<string, RunSummary> = {};
    for (const projectId of projectIds) {
      const scenario = scenarios.get(projectId);
      if (!scenario) continue;
      const row = (sessions ?? []).find((item) => item.user_id === member.student_id && item.activity_id === projectId);
      runs[projectId] = summariseRun(scenario, row ? (row as { state: SimulationState; status: string; outcome: string | null; updated_at: string }) : null);
    }
    return { id: member.student_id, name, email, joinedAt: member.joined_at, runs };
  });
}

// ---------------------------------------------------------------------------
// The student's side.

export async function joinClass(db: SupabaseClient, code: string) {
  const clean = code.trim().toUpperCase();
  if (!isJoinCode(clean)) throw new HttpError(400, "A class code is six letters and numbers.");
  const { data, error } = await db.rpc("join_class", { code: clean });
  if (error) {
    if (error.code === "P0002") throw new HttpError(404, "No class has that code. Check it with your instructor.");
    console.error("join_class failed", { code: error.code, message: redactSecrets(error.message) });
    throw new HttpError(503, "Could not join the class. Please retry.");
  }
  const row = (data as { id: string; name: string }[] | null)?.[0];
  if (!row) throw new HttpError(503, "Could not join the class. Please retry.");
  return row;
}

/** The classes the student is in, with their assigned projects. */
export async function studentClasses(db: SupabaseClient, studentId: string) {
  const { data: memberships } = await db.from("class_members").select("class_id").eq("student_id", studentId);
  const classIds = (memberships ?? []).map((row) => row.class_id as string);
  if (!classIds.length) return [];
  const [{ data: classes }, { data: projects }] = await Promise.all([
    db.from("classes").select("id,name").in("id", classIds),
    db.from("class_projects").select("class_id,project_id").in("class_id", classIds),
  ]);
  // Titles of the instructors' own projects; the student can't read those rows themselves.
  const generated = [...new Set((projects ?? []).map((item) => item.project_id as string).filter(isGeneratedId))];
  const { data: titles } = generated.length ? await recordDb().from("generated_projects").select("id,title").in("id", generated) : { data: [] };
  const known = [...ASSIGNABLE, ...((titles ?? []) as { id: string; title: string }[])];
  return (classes ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    projects: (projects ?? [])
      .filter((item) => item.class_id === row.id)
      .map((item) => known.find((project) => project.id === item.project_id))
      .filter((project): project is { id: string; title: string } => Boolean(project)),
  }));
}
