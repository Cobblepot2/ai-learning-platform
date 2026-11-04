import { z } from "zod";
import { assignableFor, assignProjects, loadOwnClass } from "@/lib/classes";
import { apiError, HttpError, requireAccount } from "@/lib/supabase/server";

/* Sets which projects the class is assigned: built-in ones, or the instructor's own. */
const bodySchema = z.object({ projects: z.array(z.string().max(64)).max(20) });

export async function PUT(req: Request, { params }: { params: Promise<{ classId: string }> }) {
  try {
    const { classId } = await params;
    const { db, user } = await requireAccount(true);
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "That list of projects is not valid.");
    if (!(await loadOwnClass(db, user.id, classId))) throw new HttpError(404, "That class doesn't exist.");
    const allowed = (await assignableFor(db)).map((project) => project.id);
    const projects = await assignProjects(db, classId, parsed.data.projects, allowed);
    return Response.json({ projects });
  } catch (error) {
    return apiError(error);
  }
}
