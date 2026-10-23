import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeCoursePreference,
  normalizeProfile,
  preferredLanguageName,
  profileToRow,
} from "../src/lib/learner/preferences";

test("legacy profiles keep their data and gain new preference defaults", () => {
  const legacy = normalizeProfile({
    displayName: "  Mei  ",
    background: "cs_graduate",
    experience: "comfortable",
    goal: "career",
    language: "zh",
  });
  assert.equal(legacy.displayName, "Mei");
  assert.equal(legacy.background, "cs_graduate");
  assert.equal(legacy.experience, "comfortable");
  assert.equal(legacy.goal, "career");
  assert.equal(legacy.learningStyle, "balanced");
  // Old "zh" was labelled Traditional Chinese and must not become Simplified.
  assert.equal(legacy.language, "zh-Hant");
});

test("language codes are normalized and unknown values fall back safely", () => {
  assert.equal(normalizeProfile({ language: "zh-CN" }).language, "zh-Hans");
  assert.equal(normalizeProfile({ language: "zh_TW" }).language, "zh-Hant");
  assert.equal(normalizeProfile({ language: "fr" }).language, "en");
  assert.equal(normalizeProfile({ language: "zh-Hans" }).language, "zh-Hans");
});

test("database rows use the same normalization as local profiles", () => {
  const profile = normalizeProfile({
    display_name: "Ari",
    language: "zh-Hant",
    goal: "build",
    learning_style: "step_by_step",
    background: null,
    experience: null,
  });
  assert.deepEqual(profile, {
    displayName: "Ari",
    language: "zh-Hant",
    goal: "build",
    learningStyle: "step_by_step",
    background: null,
    experience: null,
  });
});

test("writing preferences does not erase legacy profile columns", () => {
  const preserved = profileToRow(
    normalizeProfile({ displayName: "A", background: "non_cs", experience: "some" }),
  );
  assert.equal(preserved.background, "non_cs");
  assert.equal(preserved.experience, "some");
  const fresh = profileToRow(normalizeProfile({ displayName: "B" }));
  assert.equal("background" in fresh, false);
  assert.equal("experience" in fresh, false);
});

test("role-play language follows zh-Hans, zh-Hant and legacy zh", () => {
  assert.equal(preferredLanguageName(null), "English");
  assert.equal(preferredLanguageName({ language: "zh" }), "Traditional Chinese (繁體中文)");
  assert.equal(preferredLanguageName({ language: "zh-Hans" }), "Simplified Chinese (简体中文)");
  assert.equal(preferredLanguageName({ language: "zh-Hant" }), "Traditional Chinese (繁體中文)");
  assert.equal(preferredLanguageName({ language: "zh-CN" }), "Simplified Chinese (简体中文)");
  assert.equal(preferredLanguageName({ language: "fr" }), "English");
});

test("course preferences are scoped and validated independently", () => {
  assert.deepEqual(
    normalizeCoursePreference({ experience: "none", goal: "understand" }),
    { experience: "none", goal: "understand" },
  );
  assert.equal(normalizeCoursePreference({ experience: "expert" }), null);
  assert.equal(normalizeCoursePreference({ goal: "understand" }), null);
});
