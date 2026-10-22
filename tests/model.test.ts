import test from "node:test";
import assert from "node:assert/strict";
import { parseCourse } from "../src/lib/learning/model";
import {
  validateActivity,
  sameActivityContent,
} from "../src/lib/learning/registry";
import { exampleCourse } from "../src/lib/learning/examples";
import { courses, lessonAsText } from "../src/content/courses";

test("two domains reuse the same model, with no required quiz or coding activity", () => {
  for (const domain of ["software", "english"] as const) {
    const course = parseCourse(exampleCourse(domain));
    assert.deepEqual(
      course.lessons[0].blocks.map((b) => b.activityType),
      ["reading", "response"],
    );
    assert.ok(
      lessonAsText(course.lessons[0]).includes(
        course.lessons[0].blocks[1].activityType,
      ),
    );
  }
});
test("unknown activities, versions and invalid choice answers are rejected", () => {
  assert.equal(
    validateActivity({
      type: "activity",
      id: "x",
      version: 1,
      activityType: "execute-javascript",
      config: { code: "alert(1)" },
    }).success,
    false,
  );
  assert.equal(
    validateActivity({
      type: "activity",
      id: "x",
      version: 2,
      activityType: "reading",
      config: { markdown: "x" },
    }).success,
    false,
  );
  assert.equal(
    validateActivity({
      type: "activity",
      id: "x",
      version: 1,
      activityType: "choice",
      config: {
        question: "x",
        options: ["a", "b"],
        answer: 7,
        explanation: "x",
      },
    }).success,
    false,
  );
});
test("duplicate IDs are rejected; content-only courses are valid", () => {
  const course = exampleCourse("english");
  course.lessons[0].blocks.pop();
  assert.ok(parseCourse(course));
  course.lessons[0].blocks.push(course.lessons[0].blocks[0]);
  assert.throws(() => parseCourse(course), /Duplicate/);
});
test("existing prototype lessons and stable IDs remain readable", () => {
  assert.equal(courses.length, 2);
  for (const course of courses)
    for (const lesson of course.lessons) {
      assert.ok(lessonAsText(lesson).length);
      assert.ok(lesson.id);
    }
});

test("activity completion compares content across JSONB key order and invalidates edited tasks", () => {
  const activity = exampleCourse("english").lessons[0].blocks[1];
  const reordered = JSON.parse(JSON.stringify(activity));
  reordered.config = Object.fromEntries(
    Object.entries(reordered.config).reverse(),
  );
  assert.equal(sameActivityContent(activity, reordered), true);
  reordered.config.task = "A different task";
  assert.equal(sameActivityContent(activity, reordered), false);
});
