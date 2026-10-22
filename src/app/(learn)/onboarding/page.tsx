"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useLearner } from "@/lib/learner-store";
import {
  BACKGROUND_LABELS,
  EXPERIENCE_LABELS,
  GOAL_LABELS,
  type Background,
  type Experience,
  type Goal,
  type Language,
  type LearnerProfile,
} from "@/lib/types";

function Choice<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Record<T, string>;
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 font-medium text-stone-900">{label}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {(Object.keys(options) as T[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={`rounded-xl border px-4 py-3 text-left text-sm transition ${
              value === key ? "border-indigo-500 bg-indigo-50 text-indigo-900" : "border-stone-200 bg-white hover:border-stone-300"
            }`}
          >
            {options[key]}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

const LANGUAGE_LABELS: Record<Language, string> = { en: "English", zh: "中文 (Traditional Chinese)" };

export default function OnboardingPage() {
  const router = useRouter();
  const { profile, saveProfile, ready } = useLearner();
  const [displayName, setDisplayName] = useState("");
  const [background, setBackground] = useState<Background | null>(null);
  const [experience, setExperience] = useState<Experience | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [language, setLanguage] = useState<Language>("en");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.displayName);
    setBackground(profile.background);
    setExperience(profile.experience);
    setGoal(profile.goal);
    setLanguage(profile.language);
  }, [profile]);

  const complete = background && experience && goal;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!complete) return;
    setSaving(true);
    const next: LearnerProfile = { displayName: displayName.trim(), background, experience, goal, language };
    await saveProfile(next);
    router.push("/#courses");
  }

  if (!ready) return null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-bold text-stone-900">Tell us about you</h1>
      <p className="mt-2 text-stone-600">
        The AI tutor and feedback adapt to your background and goals. You can change this any time.
      </p>
      <form onSubmit={submit} className="mt-8 space-y-8">
        <label className="block">
          <span className="mb-2 block font-medium text-stone-900">What should we call you?</span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={40}
            placeholder="Your first name (optional)"
            className="w-full rounded-xl border border-stone-300 px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
        </label>
        <Choice label="Your background" options={BACKGROUND_LABELS} value={background} onChange={setBackground} />
        <Choice label="Experience in the subject you want to study" options={EXPERIENCE_LABELS} value={experience} onChange={setExperience} />
        <Choice label="What do you want to get out of this?" options={GOAL_LABELS} value={goal} onChange={setGoal} />
        <Choice label="Preferred language for AI explanations" options={LANGUAGE_LABELS} value={language} onChange={setLanguage} />
        <button
          type="submit"
          disabled={!complete || saving}
          className="w-full rounded-lg bg-indigo-600 px-5 py-3 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save and choose a course"}
        </button>
      </form>
    </div>
  );
}
