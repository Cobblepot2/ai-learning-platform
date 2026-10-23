import test from "node:test";
import assert from "node:assert/strict";
import { describeLearner } from "../src/lib/ai/gemini";
import { normalizeProfile } from "../src/lib/learner/preferences";

test("tutor context uses language, goal, learning style and course level", () => {
  const profile = normalizeProfile({
    displayName: "Mei",
    language: "zh-Hans",
    goal: "build",
    learning_style: "interactive",
    background: "cs_graduate",
    experience: "comfortable",
  });
  const context = describeLearner(profile, {
    experience: "none",
    goal: "understand",
  });
  assert.match(context, /Simplified Chinese/);
  assert.match(context, /Practise and apply/);
  assert.match(context, /More interactive activities/);
  assert.match(context, /new to it/);
  assert.match(context, /Goal for this course: Understand new concepts/);
  assert.match(context, /override the general preference/);
  // Global background and experience must not describe knowledge of this subject.
  assert.doesNotMatch(context, /CS graduate/);
  assert.doesNotMatch(context, /Background:/);
});

test("learners without preferences still get a usable default", () => {
  const context = describeLearner(null);
  assert.match(context, /No global learner preferences/);
  assert.match(context, /balanced/i);
  assert.match(context, /Do not infer subject knowledge/);
});
