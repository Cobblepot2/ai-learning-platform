"use client";

import { useEffect, useState } from "react";
import { PreferenceChoice } from "@/components/learning/PreferenceChoice";
import { useLearner } from "@/lib/learner-store";
import {
  EXPERIENCE_LABELS,
  GOAL_LABELS,
  type Experience,
  type Goal,
} from "@/lib/types";

/**
 * Optional, course-scoped preferences. Opening a course must never force a
 * questionnaire, so this stays collapsed until the learner chooses to set it.
 */
export function CoursePreferences({ courseId }: { courseId: string }) {
  const { profile, coursePreferences, saveCoursePreference } = useLearner();
  const existing = coursePreferences[courseId];
  const [experience, setExperience] = useState<Experience>(
    existing?.experience ?? "some",
  );
  const [goal, setGoal] = useState<Goal>(
    existing?.goal ?? profile?.goal ?? "understand",
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!existing) return;
    setExperience(existing.experience);
    setGoal(existing.goal);
  }, [existing]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await saveCoursePreference(courseId, { experience, goal });
      setSaved(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <details className="mt-8 rounded-2xl border border-stone-200 bg-white">
      <summary className="cursor-pointer list-none px-5 py-4 [&::-webkit-details-marker]:hidden">
        <span className="font-medium text-stone-900">
          Make the tutor fit this course
        </span>
        <span className="mt-1 block text-sm text-stone-500">
          Optional. Your level here is saved for this course only.
          {existing ? " Preferences set." : ""}
        </span>
      </summary>
      <form
        onSubmit={submit}
        className="space-y-4 border-t border-stone-200 px-5 py-4"
      >
        <PreferenceChoice
          label="Your experience with this subject"
          name={`experience-${courseId}`}
          options={EXPERIENCE_LABELS}
          value={experience}
          onChange={setExperience}
          columns={3}
        />
        <PreferenceChoice
          label="Your goal for this course"
          name={`goal-${courseId}`}
          options={GOAL_LABELS}
          value={goal}
          onChange={setGoal}
        />
        {error && (
          <p role="alert" className="text-sm text-rose-700">
            {error}
          </p>
        )}
        {saved && (
          <p role="status" className="text-sm text-emerald-700">
            Saved for this course.
          </p>
        )}
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save for this course"}
        </button>
      </form>
    </details>
  );
}
