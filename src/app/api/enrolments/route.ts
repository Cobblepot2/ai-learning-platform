import { z } from "zod";
import { apiError, HttpError, requireAccount } from "@/lib/supabase/server";
import { ownedCourse } from "@/lib/learning/repository";
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { db, user } = await requireAccount(body.action !== "claim");
    if (body.action === "claim") {
      const { data, error } = await db.rpc("claim_course_invitations");
      if (error) throw error;
      return Response.json({ joined: data });
    }
    const { courseId, emails } = z
      .object({
        courseId: z.string().uuid(),
        emails: z
          .array(z.string().trim().email().toLowerCase())
          .min(1)
          .max(100),
      })
      .parse(body);
    await ownedCourse(courseId, db, user.id);
    const { error } = await db.from("course_invitations").upsert(
      [...new Set(emails)].map((email) => ({ course_id: courseId, email })),
      { ignoreDuplicates: true },
    );
    if (error) throw error;
    return Response.json({ invited: new Set(emails).size });
  } catch (e) {
    return apiError(e);
  }
}
export async function DELETE(req: Request) {
  try {
    const { db, user } = await requireAccount(true);
    const url = new URL(req.url);
    const courseId = url.searchParams.get("courseId") ?? "";
    await ownedCourse(courseId, db, user.id);
    const studentId = url.searchParams.get("studentId");
    const email = url.searchParams.get("email")?.trim().toLowerCase();
    if (studentId) {
      const { error } = await db
        .from("course_enrolments")
        .delete()
        .eq("course_id", courseId)
        .eq("student_id", studentId);
      if (error) throw error;
      return Response.json({ removed: "student" });
    }
    if (email) {
      const { error } = await db
        .from("course_invitations")
        .delete()
        .eq("course_id", courseId)
        .eq("email", email);
      if (error) throw error;
      return Response.json({ removed: "invitation" });
    }
    throw new HttpError(400, "Specify a student or an invitation email.");
  } catch (e) {
    return apiError(e);
  }
}
export async function GET(req: Request) {
  try {
    const { db, user } = await requireAccount(true);
    const id = new URL(req.url).searchParams.get("courseId") ?? "";
    const course = await ownedCourse(id, db, user.id);
    const [enrolments, invitations, attempts, progress] = await Promise.all([
      db.from("course_enrolments").select("*").eq("course_id", id),
      db.from("course_invitations").select("*").eq("course_id", id),
      db
        .from("learning_attempts")
        .select("*")
        .eq("course_id", id)
        .order("created_at"),
      db.from("lesson_progress").select("*").eq("course_id", id),
    ]);
    for (const result of [enrolments, invitations, attempts, progress])
      if (result.error) throw result.error;
    const ids = (enrolments.data ?? []).map((e) => e.student_id);
    const profiles = ids.length
      ? await db.from("profiles").select("id,display_name").in("id", ids)
      : { data: [], error: null };
    if (profiles.error) throw profiles.error;
    return Response.json({
      course,
      enrolments: enrolments.data,
      invitations: invitations.data,
      attempts: attempts.data,
      progress: progress.data,
      profiles: profiles.data,
    });
  } catch (e) {
    return apiError(e);
  }
}
