"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PreferenceChoice } from "@/components/learning/PreferenceChoice";
import { useLearner } from "@/lib/learner-store";
import {
  GOAL_LABELS,
  LANGUAGE_LABELS,
  LEARNING_STYLE_LABELS,
  type Goal,
  type Language,
  type LearnerProfile,
  type LearningStyle,
} from "@/lib/types";

export default function OnboardingPage() {
  const { profile, saveProfile, ready } = useLearner();
  const [displayName, setDisplayName] = useState("");
  const [language, setLanguage] = useState<Language>("en");
  const [goal, setGoal] = useState<Goal>("understand");
  const [learningStyle, setLearningStyle] =
    useState<LearningStyle>("balanced");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.displayName);
    setLanguage(profile.language);
    setGoal(profile.goal);
    setLearningStyle(profile.learningStyle);
  }, [profile]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    const next: LearnerProfile = {
      displayName: displayName.trim(),
      language,
      goal,
      learningStyle,
      // Keep any legacy values the account already had; they are no longer
      // required, but a preference edit should not erase old profile data.
      background: profile?.background ?? null,
      experience: profile?.experience ?? null,
    };
    try {
      await saveProfile(next);
      setSaved(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (!ready) return null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
      <header>
        <p className="text-sm font-semibold text-indigo-600">DevPath</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-stone-900">
          Make learning yours.
        </h1>
        <p className="mt-2 text-stone-600">
          Set your learning preferences. You can always change them later.
        </p>
      </header>

      <form onSubmit={submit} className="mt-8 space-y-7" noValidate>
        <label className="block">
          <span className="font-medium text-stone-900">
            Display name <span className="font-normal text-stone-500">(optional)</span>
          </span>
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            maxLength={40}
            autoComplete="name"
            placeholder="How should we address you?"
            className="mt-2 w-full rounded-xl border border-stone-300 px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
        </label>

        <PreferenceChoice
          label="Preferred language"
          hint="The AI tutor will explain and reply in this language."
          name="language"
          options={LANGUAGE_LABELS}
          value={language}
          onChange={setLanguage}
          columns={3}
        />

        <PreferenceChoice
          label="Main learning goal"
          name="goal"
          options={GOAL_LABELS}
          value={goal}
          onChange={setGoal}
        />

        <PreferenceChoice
          label="Learning style"
          hint="Optional. This shapes how the tutor explains and guides you."
          name="learning-style"
          options={LEARNING_STYLE_LABELS}
          value={learningStyle}
          onChange={setLearningStyle}
        />

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
          >
            {error}
          </p>
        )}
        {saved && (
          <div
            role="status"
            className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
          >
            <span className="font-medium">Preferences saved.</span>
            <Link href="/#courses" className="underline">
              Browse courses →
            </Link>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-5 py-3 font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save preferences"}
          </button>
          <Link
            href="/#courses"
            className="rounded-lg px-3 py-3 text-center text-sm font-medium text-stone-600 transition hover:text-indigo-700"
          >
            Skip for now
          </Link>
        </div>
      </form>
    </div>
  );
}
