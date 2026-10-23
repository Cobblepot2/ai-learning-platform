import {
  BACKGROUND_LABELS,
  LANGUAGE_NAMES,
  type Background,
  type CoursePreference,
  type Experience,
  type Goal,
  type Language,
  type LearnerProfile,
  type LearningStyle,
} from "@/lib/types";

export const DEFAULT_PROFILE: LearnerProfile = {
  displayName: "",
  language: "en",
  goal: "understand",
  learningStyle: "balanced",
  background: null,
  experience: null,
};

const GOALS: Goal[] = ["understand", "build", "career"];
const STYLES: LearningStyle[] = ["balanced", "step_by_step", "interactive"];
const EXPERIENCES: Experience[] = ["none", "some", "comfortable"];
const BACKGROUNDS = Object.keys(BACKGROUND_LABELS) as Background[];

/** Maps legacy `zh` (previously labelled Traditional Chinese) without losing it. */
export function normalizeLanguage(value: unknown): Language {
  if (typeof value !== "string") return "en";
  const normalized = value.trim().toLowerCase().replace("_", "-");
  if (
    normalized === "zh-hans" ||
    normalized === "zh-cn" ||
    normalized === "zh-sg" ||
    normalized === "cn"
  ) {
    return "zh-Hans";
  }
  if (
    normalized === "zh" ||
    normalized === "zh-hant" ||
    normalized === "zh-tw" ||
    normalized === "zh-hk"
  ) {
    return "zh-Hant";
  }
  return "en";
}

export function normalizeGoal(value: unknown): Goal {
  return GOALS.includes(value as Goal) ? (value as Goal) : "understand";
}

export function normalizeLearningStyle(value: unknown): LearningStyle {
  return STYLES.includes(value as LearningStyle)
    ? (value as LearningStyle)
    : "balanced";
}

export function normalizeExperience(value: unknown): Experience | null {
  return EXPERIENCES.includes(value as Experience)
    ? (value as Experience)
    : null;
}

function normalizeBackground(value: unknown): Background | null {
  return BACKGROUNDS.includes(value as Background)
    ? (value as Background)
    : null;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Accepts the old local profile shape and the new one. Old profiles keep
 * `background`/`experience`; missing preferences get sensible defaults.
 */
export function normalizeProfile(value: unknown): LearnerProfile {
  const raw = record(value);
  const displayName =
    typeof raw.displayName === "string"
      ? raw.displayName
      : typeof raw.display_name === "string"
        ? raw.display_name
        : "";
  return {
    displayName: displayName.trim().slice(0, 40),
    language: normalizeLanguage(raw.language),
    goal: normalizeGoal(raw.goal),
    learningStyle: normalizeLearningStyle(
      raw.learningStyle ?? raw.learning_style,
    ),
    background: normalizeBackground(raw.background),
    experience: normalizeExperience(raw.experience),
  };
}

/** Database rows use snake_case; this is the one place that translation lives. */
export function profileFromRow(value: unknown): LearnerProfile {
  return normalizeProfile(value);
}

export function profileToRow(profile: LearnerProfile) {
  return {
    display_name: profile.displayName,
    language: profile.language,
    goal: profile.goal,
    learning_style: profile.learningStyle,
    // Legacy columns are only written when we actually have a value, so a
    // preference edit cannot erase data written by an older version.
    ...(profile.background ? { background: profile.background } : {}),
    ...(profile.experience ? { experience: profile.experience } : {}),
  };
}

/**
 * Name of the language a role-play or lab should reply in.
 * Accepts a raw client profile, including the legacy `"zh"` code.
 */
export function preferredLanguageName(value: unknown): string {
  if (value == null) return LANGUAGE_NAMES.en;
  return LANGUAGE_NAMES[normalizeProfile(value).language];
}

export function normalizeCoursePreference(
  value: unknown,
): CoursePreference | null {
  const raw = record(value);
  const experience = normalizeExperience(raw.experience);
  if (!experience || !GOALS.includes(raw.goal as Goal)) return null;
  return { experience, goal: raw.goal as Goal };
}
