import { requireAccount, apiError, HttpError } from "@/lib/supabase/server";
import { parseCourse } from "@/lib/learning/model";
import { ownedCourse } from "@/lib/learning/repository";

export async function GET(req: Request) {
  try {
    const { db, user } = await requireAccount();
    let query = db.from("courses").select("*");
    if (!new URL(req.url).searchParams.has("accessible"))
      query = query.eq("owner_id", user.id);
    const { data, error } = await query.order("updated_at", {
      ascending: false,
    });
    if (error) throw error;
    return Response.json(data);
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
    if (
      !["draft", "published"].includes(body.status) ||
      !["private", "enrolled", "public"].includes(body.visibility)
    )
      throw new HttpError(400, "Invalid publication settings.");
    if (
      !isTeacher &&
      (body.status !== "draft" || body.visibility !== "private")
    )
      throw new HttpError(403, "Student courses remain private.");
    if (
      body.status === "published" &&
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
        status: body.status,
        visibility: body.visibility,
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
      throw new HttpError(400, "Unpublish before deleting.");
    const { error } = await db
      .from("courses")
      .delete()
      .eq("id", row.id)
      .eq("owner_id", user.id);
    if (error) throw error;
    return Response.json({ deleted: true });
  } catch (e) {
    return apiError(e);
  }
}
