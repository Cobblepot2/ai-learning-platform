import { applyEdits, editSchema } from "@/lib/projects/generated/edit";
import { loadOwnDraft, updateOwnDraft } from "@/lib/projects/generated/store";
import { apiError, HttpError, requireAccount } from "@/lib/supabase/server";

/* Saves an instructor's edits to their own project, if it still passes every check. */
export async function PUT(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const { user } = await requireAccount(true);
    const parsed = editSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "Every field needs some text.");
    const draft = await loadOwnDraft(projectId, user.id);
    if (!draft) throw new HttpError(404, "That project doesn't exist.");
    const result = await applyEdits(draft, parsed.data, projectId);
    if ("problems" in result) return Response.json({ error: "The project wouldn't play fairly with these changes.", problems: result.problems }, { status: 422 });
    await updateOwnDraft(projectId, user.id, result.draft);
    return Response.json({ saved: true });
  } catch (error) {
    return apiError(error);
  }
}
