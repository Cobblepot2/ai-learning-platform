import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { HttpError, recordDb } from "@/lib/supabase/server";
import type { ProjectScenario } from "../types";
import { buildScenario, TEMPLATE_VERSION } from "./build";
import { projectDraftSchema, type ProjectDraft } from "./draft";
import type { GeneratedProject, ProjectRequest } from "./generate";

/*
 * Generated projects live in public.generated_projects, private to their owner,
 * except that an instructor's project may be played by the classes it is
 * assigned to. The draft (hidden facts, flawed versions) is read only here,
 * with the service role, after that check. Browsers can read the listing
 * columns of their own rows only.
 */

const PREFIX = "gen-";

export type GeneratedListing = {
  id: string;
  title: string;
  tagline: string;
  summary: string;
  domain: string;
  topic: string;
  created_at: string;
};

export function isGeneratedId(id: string) {
  return id.startsWith(PREFIX);
}

export function newGeneratedId() {
  // 12 base-36 characters from 9 random bytes.
  return PREFIX + BigInt(`0x${randomBytes(9).toString("hex")}`).toString(36).padStart(12, "0").slice(-12);
}

/** True when the project is assigned to a class the user is in. */
async function assignedToUser(id: string, userId: string) {
  const service = recordDb();
  const { data: memberships } = await service.from("class_members").select("class_id").eq("student_id", userId);
  const classIds = (memberships ?? []).map((row) => row.class_id as string);
  if (!classIds.length) return false;
  const { data } = await service.from("class_projects").select("class_id").eq("project_id", id).in("class_id", classIds).limit(1);
  return Boolean(data?.length);
}

/** The project's row for its owner, or for a student whose class it's assigned to. */
async function playableRow<T extends string>(id: string, userId: string, columns: T) {
  if (!isGeneratedId(id)) return null;
  const { data, error } = await recordDb().from("generated_projects").select(`owner_id,${columns}`).eq("id", id).maybeSingle();
  if (error) throw new HttpError(503, "Could not load this project. Please retry.");
  if (!data) return null;
  const row = data as unknown as Record<string, unknown> & { owner_id: string };
  return row.owner_id === userId || (await assignedToUser(id, userId)) ? row : null;
}

/** What the desktop shows before the run loads. */
export async function loadPlayableListing(id: string, userId: string) {
  const row = await playableRow(id, userId, "title,summary,path_id");
  return row ? { title: row.title as string, summary: row.summary as string, pathId: (row.path_id as string | null) ?? null, own: row.owner_id === userId } : null;
}

/** The owner's draft, to edit or to build on. */
export async function loadOwnDraft(id: string, ownerId: string): Promise<ProjectDraft | null> {
  if (!isGeneratedId(id)) return null;
  const { data, error } = await recordDb().from("generated_projects").select("owner_id,draft").eq("id", id).maybeSingle();
  if (error) throw new HttpError(503, "Could not load this project. Please retry.");
  if (!data || data.owner_id !== ownerId) return null;
  const draft = projectDraftSchema.safeParse(data.draft);
  return draft.success ? draft.data : null;
}

/** Saves an edited draft over the owner's project. The caller has checked it. */
export async function updateOwnDraft(id: string, ownerId: string, draft: ProjectDraft) {
  const { data, error } = await recordDb()
    .from("generated_projects")
    .update({ draft, title: draft.title, tagline: draft.tagline, summary: draft.summary })
    .eq("id", id)
    .eq("owner_id", ownerId)
    .select("id");
  if (error || !data?.length) throw new HttpError(503, "Could not save the project. Please retry.");
}

/** The playable scenario, or null when it doesn't exist or this user may not play it. */
export async function loadGeneratedScenario(id: string, userId: string): Promise<ProjectScenario | null> {
  const data = await playableRow(id, userId, "draft");
  if (!data) return null;
  const draft = projectDraftSchema.safeParse(data.draft);
  if (!draft.success) throw new HttpError(500, "This project can't be opened any more.");
  return buildScenario(draft.data, { id, version: TEMPLATE_VERSION });
}

export async function saveGeneratedProject(
  ownerId: string,
  request: ProjectRequest,
  project: GeneratedProject,
  path?: { id: string; step: number },
) {
  const { error } = await recordDb().from("generated_projects").insert({
    id: project.scenario.id,
    owner_id: ownerId,
    domain: (request.domain.trim() || project.draft.domain).slice(0, 80),
    topic: request.topic.trim().slice(0, 200),
    title: project.draft.title,
    tagline: project.draft.tagline,
    summary: project.draft.summary,
    draft: project.draft,
    template_version: TEMPLATE_VERSION,
    model: project.model,
    ...(path ? { path_id: path.id, path_step: path.step } : {}),
  });
  // 23505: another request already made this step's project.
  if (error?.code === "23505" && path) throw new HttpError(409, "This step already has a project. Reload the page.");
  if (error) throw new HttpError(503, "The project was written but could not be saved. Please retry.");
}

/** The signed-in user's own projects, newest first, through their row-level-secured client. */
export async function listOwnGeneratedProjects(db: SupabaseClient): Promise<GeneratedListing[]> {
  const { data, error } = await db
    .from("generated_projects")
    .select("id,title,tagline,summary,domain,topic,created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return [];
  return data as GeneratedListing[];
}
