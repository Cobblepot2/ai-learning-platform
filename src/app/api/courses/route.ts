import { requireAccount, apiError, HttpError } from "@/lib/supabase/server";
import { parseCourse } from "@/lib/learning/model";
import { ownedCourse } from "@/lib/learning/repository";
import { courseForClient, type StoredCourseRow } from "@/lib/learning/course-view";

export async function GET(req: Request) {
  try {
    const { db, user } = await requireAccount();
    const impactId = new URL(req.url).searchParams.get("learnerImpact");
    if (impactId) {
      await ownedCourse(impactId, db, user.id);
      const [attempts, enrolments, progress] = await Promise.all([
        db
          .from("learning_attempts")
          .select("id", { count: "exact", head: true })
          .eq("course_id", impactId),
        db
          .from("course_enrolments")
          .select("student_id", { count: "exact", head: true })
          .eq("course_id", impactId),
        db
          .from("lesson_progress")
          .select("user_id", { count: "exact", head: true })
          .eq("course_id", impactId),
      ]);
      for (const result of [attempts, enrolments, progress]) {
        if (result.error) throw result.error;
      }
      return Response.json({
        attempts: attempts.count ?? 0,
        enrolments: enrolments.count ?? 0,
        progress: progress.count ?? 0,
      });
    }
    const accessible = new URL(req.url).searchParams.has("accessible");
    let query = db.from("courses").select("*");
    if (!accessible) query = query.eq("owner_id", user.id);
    const { data, error } = await query.order("updated_at", {
      ascending: false,
    });
    if (error) throw error;
    return Response.json(
      (data ?? []).map((row) =>
        courseForClient(row as StoredCourseRow, user.id, accessible),
      ),
    );
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(req: Request) {
  try {
    const { db, user } = await requireAccount();
    const document = parseCourse(await req.json());
    const { data, error } = await db
      .from("courses")
      .insert({
        id: document.id,
        owner_id: user.id,
        document,
        status: "draft",
        visibility: "private",
      })
      .select()
      .single();
    if (error) throw error;
    return Response.json(data, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
export async function PUT(req: Request) {
  try {
    const { db, user, isTeacher } = await requireAccount();
    const body = await req.json();
    const document = parseCourse(body.document);
    await ownedCourse(document.id, db, user.id);
    const status = body.status === "archived" ? "archived" : body.status;
    const visibility = status === "archived" ? "private" : body.visibility;
    if (
      !["draft", "published", "archived"].includes(status) ||
      !["private", "enrolled", "public"].includes(visibility)
    )
      throw new HttpError(400, "Invalid publication settings.");
    if (!isTeacher && (status !== "draft" || visibility !== "private"))
      throw new HttpError(403, "Student courses remain private.");
    if (status === "archived" && !isTeacher)
      throw new HttpError(403, "Only an instructor can archive a course.");
    if (
      status === "published" &&
      (!document.lessons.length ||
        document.lessons.some((l) => !l.blocks.length))
    )
      throw new HttpError(
        400,
        "Published lessons need content; no specific activity type is required.",
      );
    if (!Number.isInteger(body.revision))
      throw new HttpError(400, "Missing revision.");
    const { data, error } = await db
      .from("courses")
      .update({
        document,
        status,
        visibility,
        revision: body.revision + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", document.id)
      .eq("owner_id", user.id)
      .eq("revision", body.revision)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data)
      throw new HttpError(
        409,
        "This course changed elsewhere. Reload before saving.",
      );
    return Response.json(data);
  } catch (e) {
    return apiError(e);
  }
}
export async function DELETE(req: Request) {
  try {
    const { db, user } = await requireAccount();
    const id = new URL(req.url).searchParams.get("id");
    const row = await ownedCourse(id ?? "", db, user.id);
    if (row.status !== "draft")
      throw new HttpError(400, "Unpublish before deleting, or archive the course.");
    const { count, error: countError } = await db
      .from("learning_attempts")
      .select("id", { count: "exact", head: true })
      .eq("course_id", row.id);
    if (countError) throw countError;
    if ((count ?? 0) > 0) {
      throw new HttpError(
        409,
        "This course has learner records. Archive it instead of deleting.",
      );
    }
    const { error } = await db
      .from("courses")
      .delete()
      .eq("id", row.id)
      .eq("owner_id", user.id);
    if (error) {
      if (/restrict|foreign key|23503/i.test(error.message)) {
        throw new HttpError(
          409,
          "This course has learner records. Archive it instead of deleting.",
        );
      }
      throw error;
    }
    return Response.json({ deleted: true });
  } catch (e) {
    return apiError(e);
  }
}
