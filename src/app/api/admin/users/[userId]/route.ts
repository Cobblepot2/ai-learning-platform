import { z } from "zod";
import { requireAdmin, setRole } from "@/lib/admin";
import { apiError, HttpError } from "@/lib/supabase/server";

/* An administrator makes an account an instructor, or a student again. */
const bodySchema = z.object({ role: z.string().max(20) });

export async function PUT(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const { userId } = await params;
    const actor = await requireAdmin();
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "A role is student or instructor.");
    if (!/^[0-9a-f-]{36}$/.test(userId)) throw new HttpError(404, "That account doesn't exist.");
    await setRole(actor.id, userId, parsed.data.role);
    return Response.json({ id: userId, role: parsed.data.role });
  } catch (error) {
    return apiError(error);
  }
}
