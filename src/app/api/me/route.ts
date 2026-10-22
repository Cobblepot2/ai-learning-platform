import { requireAccount, apiError } from "@/lib/supabase/server";
export async function GET() {
  try {
    const { user, isTeacher } = await requireAccount();
    return Response.json({ id: user.id, isTeacher });
  } catch (e) {
    return apiError(e);
  }
}
