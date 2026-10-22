import { apiError, requireAccount } from "@/lib/supabase/server";
import { lessonAsText } from "@/content/courses";
import { readLesson } from "@/lib/learning/repository";
import { enforceQuota } from "@/lib/ai/quota";
import { badRequest, describeLearner, missingKey, streamText, toContents } from "@/lib/ai/gemini";
import {
  normalizeCoursePreference,
  normalizeProfile,
} from "@/lib/learner/preferences";

export async function POST(req: Request) {
  try {
  const { db, user } = await requireAccount();
  const noKey = missingKey();
  if (noKey) return noKey;
  await enforceQuota(db, user.id, "tutor");

  const { courseId, lessonId, profile, coursePreference, messages } = await req.json();
  const found = (await readLesson(courseId, lessonId));
  if (!found) return badRequest("Unknown lesson");
  const history = toContents(messages);
  if (!history) return badRequest("Invalid messages");
  const learner = profile == null ? null : normalizeProfile(profile);
  const preference = normalizeCoursePreference(coursePreference);

  const system = `You are a friendly, encouraging tutor on a general-purpose learning platform for people from varied backgrounds. Teach the subject and objectives of the current lesson.

<learner>
${describeLearner(learner, preference)}
</learner>

<current_lesson course="${found.course.title}" lesson="${found.lesson.title}">
${lessonAsText(found.lesson)}
</current_lesson>

How to teach this learner:
- Reply in the learner's preferred language. Keep technical terms in English, with a short explanation the first time.
- Follow the learning style and goal in the learner context. If this course has its own experience level or goal, use it instead of the general one.
- Do not infer subject knowledge from a computer-science background or any other academic label.
- Keep replies short (usually under 150 words) and end with a question or a small next step when that helps learning.
- The lesson may contain assessments. Don't give away their answers directly; give a hint and help the learner reason it out. If they have clearly tried already, you may explain.
- If they ask about something outside the lesson, answer briefly and link it back to the course topic.`;

  return streamText({ system, contents: history });
  } catch (error) { return apiError(error); }
}
