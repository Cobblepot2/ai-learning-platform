import { z } from "zod";
import { buildScenario } from "./build";
import { projectDraftSchema, type ProjectDraft } from "./draft";
import { checkProject } from "./validate";

/*
 * What an instructor may change by hand in a project: the words people read,
 * not the structure. Names are left out because they recur across the draft;
 * a revision with the AI rewrites them everywhere. Every save goes through the
 * same checks as a generated draft.
 */

const text = z.string().trim().min(1);
const concept = z.object({ name: text, explanation: text, bridge: text, misconception: text, inTheJob: text });

export const editSchema = z.object({
  title: text,
  tagline: text,
  summary: text,
  clientEmail: z.object({ subject: text, body: text }),
  opening: text,
  replies: z.object({ problem: text, rule: text, scope: text, detail: text, environment: text, success: text }),
  concepts: z.object({ problem: concept, rule: concept }).optional(),
  endings: z.object({ success: text, failureProblem: text, failureRule: text }),
});

export type ProjectEdits = z.infer<typeof editSchema>;

const ROLES = ["problem", "rule", "scope", "detail", "environment", "success"] as const;

export function editableOf(draft: ProjectDraft): ProjectEdits {
  const pick = (role: "problem" | "rule") => {
    const { name, explanation, bridge, misconception, inTheJob } = draft.concepts![role];
    return { name, explanation, bridge, misconception, inTheJob };
  };
  return {
    title: draft.title,
    tagline: draft.tagline,
    summary: draft.summary,
    clientEmail: draft.clientEmail,
    opening: draft.interview.opening,
    replies: Object.fromEntries(ROLES.map((role) => [role, draft.facts[role].reply])) as ProjectEdits["replies"],
    concepts: draft.concepts ? { problem: pick("problem"), rule: pick("rule") } : undefined,
    endings: { success: draft.endings.success, failureProblem: draft.endings.failureProblem, failureRule: draft.endings.failureRule },
  };
}

/** The draft with the edits applied, or the reasons it can't be saved. */
export async function applyEdits(draft: ProjectDraft, edits: ProjectEdits, id: string): Promise<{ draft: ProjectDraft } | { problems: string[] }> {
  const next = structuredClone(draft);
  Object.assign(next, { title: edits.title, tagline: edits.tagline, summary: edits.summary, clientEmail: edits.clientEmail });
  next.interview.opening = edits.opening;
  for (const role of ROLES) next.facts[role].reply = edits.replies[role];
  if (next.concepts && edits.concepts) {
    for (const role of ["problem", "rule"] as const) Object.assign(next.concepts[role], edits.concepts[role]);
  }
  Object.assign(next.endings, edits.endings);

  // The draft's own limits (lengths, counts), then the playability checks.
  const parsed = projectDraftSchema.safeParse(next);
  if (!parsed.success) {
    return { problems: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`) };
  }
  const check = await checkProject(buildScenario(parsed.data, { id }), parsed.data, { requireConcepts: Boolean(parsed.data.concepts) });
  return check.problems.length ? { problems: check.problems } : { draft: parsed.data };
}
