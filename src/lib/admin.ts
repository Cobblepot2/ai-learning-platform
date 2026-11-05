import { redirect } from "next/navigation";
import { HttpError, recordDb, redactSecrets, serverDb } from "@/lib/supabase/server";

/*
 * The administrator's side: every account and its role, and how the platform
 * is being used. An admin can make an account an instructor or a student
 * again; making an admin is left to the SQL editor, and nobody changes their
 * own role. Reads and the role change use the service role, after the
 * signed-in user's own profile shows they are an admin.
 */

export const ASSIGNABLE_ROLES = ["student", "instructor"] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

/** Why a role change isn't allowed, or null when it is. */
export function roleChangeProblem(actorId: string, target: { id: string; role: string } | null, role: string): string | null {
  if (!ASSIGNABLE_ROLES.includes(role as AssignableRole)) return "A role is student or instructor.";
  if (!target) return "That account doesn't exist.";
  if (target.id === actorId) return "You can't change your own role.";
  if (target.role === "admin") return "Administrators are changed in the SQL editor.";
  return null;
}

async function roleOf(userId: string) {
  const db = await serverDb();
  const { data } = (await db?.from("profiles").select("role").eq("id", userId).maybeSingle()) ?? { data: null };
  return (data?.role as string | undefined) ?? null;
}

/** For pages: the signed-in admin, or null for anyone else. Redirects when signed out. */
export async function admin() {
  const db = await serverDb();
  const { data } = (await db?.auth.getUser()) ?? { data: { user: null } };
  if (!db || !data.user) redirect("/login");
  return (await roleOf(data.user.id)) === "admin" ? data.user : null;
}

/** For API routes: the signed-in admin, or an error. */
export async function requireAdmin() {
  const db = await serverDb();
  if (!db) throw new HttpError(503, "Configure Supabase first.");
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) throw new HttpError(401, "Sign in to continue.");
  if ((await roleOf(data.user.id)) !== "admin") throw new HttpError(403, "Administrator access required.");
  return data.user;
}

export type AdminUser = {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
  createdAt: string;
  lastSignIn: string | null;
  runs: number;
  classesTaught: number;
};

export async function listUsers(): Promise<AdminUser[]> {
  const service = recordDb();
  const [{ data: list, error }, { data: profiles }, { data: runs }, { data: classes }] = await Promise.all([
    service.auth.admin.listUsers({ perPage: 500 }),
    service.from("profiles").select("id,display_name,role"),
    service.from("simulation_sessions").select("user_id").like("course_id", "project:%"),
    service.from("classes").select("owner_id"),
  ]);
  if (error) {
    console.error("listUsers failed", { message: redactSecrets(error.message) });
    throw new HttpError(503, "Could not load the accounts. Please retry.");
  }
  const count = (rows: { [key: string]: unknown }[] | null, key: string, id: string) => (rows ?? []).filter((row) => row[key] === id).length;
  return list.users
    .map((user) => {
      const profile = (profiles ?? []).find((row) => row.id === user.id);
      return {
        id: user.id,
        email: user.email ?? null,
        name: (profile?.display_name as string | null) ?? null,
        role: (profile?.role as string | undefined) ?? "student",
        createdAt: user.created_at,
        lastSignIn: user.last_sign_in_at ?? null,
        runs: count(runs, "user_id", user.id),
        classesTaught: count(classes, "owner_id", user.id),
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Sets a student's or instructor's role. The caller is an admin (requireAdmin). */
export async function setRole(actorId: string, targetId: string, role: string) {
  const service = recordDb();
  const { data: target } = await service.from("profiles").select("id,role").eq("id", targetId).maybeSingle();
  const problem = roleChangeProblem(actorId, target as { id: string; role: string } | null, role);
  if (problem) throw new HttpError(problem.includes("doesn't exist") ? 404 : 400, problem);
  const { error } = await service.from("profiles").update({ role, updated_at: new Date().toISOString() }).eq("id", targetId);
  if (error) {
    console.error("role change failed", { code: error.code, message: redactSecrets(error.message) });
    throw new HttpError(503, "Could not change the role. Please retry.");
  }
  console.info("Role changed", { by: actorId, user: targetId, role });
}

export type Overview = {
  users: { total: number; instructors: number; admins: number };
  classes: number;
  runs: { total: number; completed: number; successful: number };
  generatedProjects: number;
  /** AI requests in the last 24 hours, by what they were for. */
  aiLastDay: { roleplay: number; feedback: number; generation: number };
};

export async function overview(): Promise<Overview> {
  const service = recordDb();
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const head = { count: "exact" as const, head: true };
  const [profiles, classes, runs, completed, successful, generated, usage] = await Promise.all([
    service.from("profiles").select("role"),
    service.from("classes").select("id", head),
    service.from("simulation_sessions").select("id", head).like("course_id", "project:%"),
    service.from("simulation_sessions").select("id", head).like("course_id", "project:%").eq("status", "completed"),
    service.from("simulation_sessions").select("id", head).like("course_id", "project:%").eq("outcome", "success"),
    service.from("generated_projects").select("id", head),
    service.from("ai_usage").select("bucket,hits").gte("window_start", since),
  ]);
  const roles = (profiles.data ?? []).map((row) => row.role as string);
  const hits = (bucket: string) => (usage.data ?? []).filter((row) => row.bucket === bucket).reduce((sum, row) => sum + Number(row.hits), 0);
  return {
    users: { total: roles.length, instructors: roles.filter((role) => role === "instructor").length, admins: roles.filter((role) => role === "admin").length },
    classes: classes.count ?? 0,
    runs: { total: runs.count ?? 0, completed: completed.count ?? 0, successful: successful.count ?? 0 },
    generatedProjects: generated.count ?? 0,
    aiLastDay: { roleplay: hits("roleplay"), feedback: hits("feedback"), generation: hits("generation") },
  };
}
