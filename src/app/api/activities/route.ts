import { z } from "zod";
import {
  apiError,
  requireAccount,
  recordDb,
  HttpError,
} from "@/lib/supabase/server";
import { getCourse, lessonAsText } from "@/content/courses";
import { ownedCourse, readLesson } from "@/lib/learning/repository";
import { missingKey } from "@/lib/ai/gemini";
import { evaluateActivity } from "@/lib/learning/evaluate";
import { isDatabaseCourseId } from "@/lib/learning/ids";
import { enforceQuota } from "@/lib/ai/quota";
import {
  completionThreshold,
  sameActivityContent,
  validateActivity,
} from "@/lib/learning/registry";
import type { LessonBlock } from "@/lib/types";

const requestSchema = z.object({
  courseId: z.string().trim().min(1).max(80),
  lessonId: z.string().min(1).max(300),
  activityId: z.string().max(300).optional(),
  response: z.string().trim().max(8000).optional(),
  action: z.enum(["submit", "complete"]),
  preview: z.boolean().default(false),
  previewHistory: z
    .array(
      z.object({
        response: z.string().max(8000),
        feedback: z.unknown().optional(),
      }),
    )
    .max(12)
    .optional(),
});

function requiredActivities(blocks: LessonBlock[]) {
  return blocks.flatMap((block) => {
    const parsed = validateActivity(block);
    if (!parsed.success || completionThreshold(parsed.data) === 0) return [];
    return [parsed.data];
  });
}

export async function GET(req: Request) {
  try {
    const { db, user } = await requireAccount();
    const courseId = z
      .string()
      .trim()
      .min(1)
      .parse(new URL(req.url).searchParams.get("courseId"));
    if (!isDatabaseCourseId(courseId)) return Response.json([]);
    const { data, error } = await db
      .from("learning_attempts")
      .select("*")
      .eq("course_id", courseId)
      .eq("user_id", user.id)
      .order("created_at");
    if (error) throw error;
    return Response.json(data);
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: Request) {
  try {
    const raw: unknown = await req.json().catch(() => null);
    const rawCourseId =
      raw && typeof raw === "object" && "courseId" in raw
        ? (raw as { courseId?: unknown }).courseId
        : undefined;
    const courseId =
      typeof rawCourseId === "string" ? rawCourseId : undefined;
    const databaseCourse = courseId ? isDatabaseCourseId(courseId) : false;
    const staticCourse = courseId ? !!getCourse(courseId) : false;
    // Unknown or malformed requests fail closed before the public static path.
    if (!databaseCourse && !staticCourse) await requireAccount();
    const body = requestSchema.parse(raw);
    if (!databaseCourse && !staticCourse) {
      throw new HttpError(404, "Lesson unavailable or you do not have access.");
    }

    // Static catalogue lessons allow guest practice for deterministic
    // activities. Learner records and AI feedback require an account below.
    let account: Awaited<ReturnType<typeof requireAccount>> | null = null;
    if (databaseCourse) account = await requireAccount();

    const found = await readLesson(body.courseId, body.lessonId);
    if (!found) {
      throw new HttpError(404, "Lesson unavailable or you do not have access.");
    }
    const persisted = databaseCourse && !body.preview;
    let revision = 0;
    let row: {
      revision: number;
      owner_id: string;
      status: string;
      visibility: string;
    } | null = null;
    if (databaseCourse && account) {
      const { data, error: rowError } = await account.db
        .from("courses")
        .select("revision,owner_id,status,visibility")
        .eq("id", body.courseId)
        .single();
      if (rowError || !data) throw new HttpError(404, "Course unavailable.");
      row = data;
      revision = data.revision;
      if (body.preview) {
        await ownedCourse(body.courseId, account.db, account.user.id);
      }
    }
    const { data: attempts, error } =
      databaseCourse && account
        ? await account.db
            .from("learning_attempts")
            .select("*")
            .eq("course_id", body.courseId)
            .eq("lesson_id", body.lessonId)
            .eq("user_id", account.user.id)
            .order("created_at")
        : { data: [], error: null };
    if (error) throw error;
    const history = persisted ? (attempts ?? []) : (body.previewHistory ?? []);

    if (body.action === "complete") {
      if (body.preview || !databaseCourse) {
        return Response.json({
          complete: true,
          preview: body.preview,
          saved: false,
        });
      }
      if (!account) throw new HttpError(401, "Sign in to continue.");
      const required = requiredActivities(found.lesson.blocks);
      if (
        required.some((block) => {
          const matching = (attempts ?? []).filter(
            (attempt) =>
              attempt.activity_id === block.id &&
              sameActivityContent(attempt.activity_snapshot, block),
          );
          return matching.length < completionThreshold(block);
        })
      ) {
        throw new HttpError(
          400,
          "Respond to each current activity before completing this lesson.",
        );
      }
      const { error: saveError } = await recordDb()
        .from("lesson_progress")
        .upsert({
          user_id: account.user.id,
          course_id: body.courseId,
          lesson_id: body.lessonId,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          block_results: Object.fromEntries(
            required.map((block) => [block.id, { done: true }]),
          ),
        });
      if (saveError) throw saveError;
      return Response.json({ complete: true, saved: true });
    }

    const activity = found.lesson.blocks.find(
      (block) => block.id === body.activityId,
    );
    const parsed = validateActivity(activity);
    if (!parsed.success) {
      throw new HttpError(400, "Unsupported or invalid activity.");
    }
    const block = parsed.data;
    if (!body.response) throw new HttpError(400, "Enter a response first.");
    const needsModel =
      block.activityType === "response" || block.activityType === "conversation";
    if (needsModel) {
      if (!account) account = await requireAccount();
      const missing = missingKey();
      if (missing) return missing;
      await enforceQuota(account.db, account.user.id, "feedback");
    }
    const prior = history
      .filter((attempt) => {
        const id = "activity_id" in attempt ? attempt.activity_id : block.id;
        return id === block.id;
      })
      .slice(-8)
      .map((attempt) => ({
        response: attempt.response,
        feedback: attempt.feedback,
      }));
    const evaluation = await evaluateActivity(block, {
      courseLanguage: found.course.language,
      lessonText: lessonAsText(found.lesson),
      objectives: found.lesson.objectives ?? found.course.objectives,
      response: body.response,
      previous: prior,
    });
    const attempt = {
      id: crypto.randomUUID(),
      user_id: account?.user.id ?? "",
      course_id: body.courseId,
      lesson_id: body.lessonId,
      activity_id: block.id,
      course_revision: revision,
      activity_snapshot: block,
      response: body.response,
      feedback: evaluation.feedback,
      score: evaluation.score,
    };
    if (persisted && row && account) {
      const writer = recordDb();
      if (
        row.owner_id !== account.user.id &&
        row.status === "published" &&
        row.visibility === "public"
      ) {
        const { error: enrolError } = await writer
          .from("course_enrolments")
          .upsert(
            { course_id: body.courseId, student_id: account.user.id },
            { ignoreDuplicates: true },
          );
        if (enrolError) {
          throw new HttpError(503, "Could not record course participation.");
        }
      }
      const { error: saveError } = await writer
        .from("learning_attempts")
        .insert(attempt);
      if (saveError) {
        throw new HttpError(503, "Feedback could not be saved. Please retry.");
      }
    }
    return Response.json({
      ...attempt,
      preview: body.preview || !databaseCourse,
      saved: persisted,
      complete: evaluation.complete,
    });
  } catch (e) {
    return apiError(e);
  }
}
