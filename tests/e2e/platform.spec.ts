import { test, expect } from "@playwright/test";
import { exampleCourse } from "../../src/lib/learning/examples";

test("public demonstration courses retain their lesson pages", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Learn by exploring, practising and improving.",
    }),
  ).toBeVisible();
  const courseLink = page.locator('a[href^="/courses/"]').first();
  await courseLink.click();
  await page.locator('a[href^="/courses/"]').first().click();
  await expect(page.getByText("AI Tutor", { exact: true })).toBeVisible();
});
test("unauthenticated write APIs fail closed without database configuration", async ({
  request,
}) => {
  for (const path of ["courses", "builder", "activities", "enrolments"]) {
    const res = await request.post(`/api/${path}`, { data: {} });
    expect([401, 403, 503]).toContain(res.status());
  }
});
// UI integration fixtures exercise the actual React builder. Cloud AI and
// Supabase are mocked explicitly; SQL permissions are tested separately.
test("learner edits a private course and reviews an AI change", async ({
  page,
}) => {
  let document = exampleCourse("english");
  const row = {
    id: document.id,
    owner_id: "teacher",
    status: "draft",
    visibility: "private",
    revision: 1,
    document,
  };
  await page.route("**/api/me", (r) =>
    r.fulfill({ json: { id: "teacher", isTeacher: true } }),
  );
  await page.route("**/api/courses", async (r) => {
    if (r.request().method() === "GET") return r.fulfill({ json: [row] });
    const body = r.request().postDataJSON();
    document = body.document;
    Object.assign(row, { ...body, revision: row.revision + 1 });
    return r.fulfill({ json: row });
  });
  await page.route("**/api/builder", (r) => {
    const body = r.request().postDataJSON();
    return r.fulfill({
      json: {
        ...body.activity,
        config: {
          ...body.activity.config,
          markdown: "An improved English explanation.",
        },
      },
    });
  });
  await page.goto("/my-courses");
  await page.getByRole("button", { name: document.title, exact: true }).click();
  await page
    .getByLabel("title", { exact: true })
    .fill("English communication workshop");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByText("Saved revision 2")).toBeVisible();
  await page
    .getByLabel("AI revision request")
    .first()
    .fill("Use simpler English");
  await page
    .getByRole("button", { name: "Propose AI revision" })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Review proposed change" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reject", exact: true }).click();
  expect(document.lessons[0].blocks[0].activityType).toBe("reading");
  expect(document.title).toBe("English communication workshop");
});
test("legacy studio links enter the guarded teaching workspace", async ({
  page,
}) => {
  await page.goto("/studio");
  await expect(page).not.toHaveURL(/\/studio$/);
  await expect(
    page.getByRole("heading", {
      name: /Sign in|Instructor access required|Teaching workspace unavailable/,
    }),
  ).toBeVisible();
});

test("onboarding saves learning preferences and loads them again", async ({
  page,
}) => {
  await page.goto("/onboarding");
  await expect(
    page.getByRole("heading", { name: "Make learning yours." }),
  ).toBeVisible();
  await page.getByLabel(/Display name/).fill("Mei");
  await page.getByText("简体中文", { exact: true }).click();
  await page
    .getByText("Practise and apply what I learn", { exact: true })
    .click();
  await page.getByText("Step-by-step guidance", { exact: true }).click();
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.getByRole("status")).toContainText("Preferences saved.");
  await expect(
    page.getByRole("link", { name: "Skip for now" }),
  ).toBeVisible();

  await page.reload();
  await expect(page.getByLabel(/Display name/)).toHaveValue("Mei");
  await expect(page.getByRole("radio", { name: "简体中文" })).toBeChecked();
  await expect(
    page.getByRole("radio", { name: "Step-by-step guidance" }),
  ).toBeChecked();
});

test("legacy onboarding data is preserved and mapped to new preferences", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "learner-profile",
      JSON.stringify({
        displayName: "Old learner",
        background: "cs_graduate",
        experience: "comfortable",
        goal: "career",
        language: "zh",
      }),
    );
  });
  await page.goto("/onboarding");
  await expect(page.getByLabel(/Display name/)).toHaveValue("Old learner");
  await expect(page.getByRole("radio", { name: "繁體中文" })).toBeChecked();
  await expect(
    page.getByRole("radio", { name: "Build practical or professional skills" }),
  ).toBeChecked();
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.getByRole("status")).toContainText("Preferences saved.");
  const stored = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("learner-profile") ?? "{}"),
  );
  expect(stored.background).toBe("cs_graduate");
  expect(stored.experience).toBe("comfortable");
  expect(stored.learningStyle).toBe("balanced");
  expect(stored.language).toBe("zh-Hant");
});

test("course-level preferences stay scoped to one course", async ({ page }) => {
  await page.goto("/courses/se-essentials");
  await page.getByText("Make the tutor fit this course").click();
  await page.getByText("New to this subject", { exact: true }).click();
  await page.getByText("Understand new concepts", { exact: true }).click();
  await page.getByRole("button", { name: "Save for this course" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Saved for this course.",
  );
  await expect(
    page.getByText("Optional. Your level here is saved for this course only. Preferences set."),
  ).toBeVisible();

  await page.goto("/courses/ai-coding-agents");
  await expect(
    page.getByText(
      "Optional. Your level here is saved for this course only. Preferences set.",
    ),
  ).not.toBeVisible();
  await page.getByText("Make the tutor fit this course").click();
  await page.getByText("Some experience", { exact: true }).click();
  await page.getByRole("button", { name: "Save for this course" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Saved for this course.",
  );

  await page.goto("/courses/se-essentials");
  await page.getByText("Make the tutor fit this course").click();
  await expect(
    page.getByRole("radio", { name: "New to this subject" }),
  ).toBeChecked();
});

test("student preview supports feedback, revision and separate attempts without saving progress", async ({
  page,
}) => {
  const document = exampleCourse("english");
  const row = {
    id: document.id,
    owner_id: "teacher",
    status: "draft",
    visibility: "private",
    revision: 1,
    document,
  };
  const submissions: { preview: boolean; response: string }[] = [];
  await page.route("**/api/me", (r) =>
    r.fulfill({ json: { id: "teacher", isTeacher: true } }),
  );
  await page.route("**/api/courses", (r) => r.fulfill({ json: [row] }));
  await page.route("**/api/activities", (r) => {
    const body = r.request().postDataJSON();
    submissions.push(body);
    return r.fulfill({
      json: {
        response: body.response,
        score: null,
        feedback: {
          summary: "Your proposed handoff addresses the schedule.",
          criteria: [
            {
              criterion: "A feasible compromise",
              assessment: "developing",
              evidence: body.response,
              suggestion: "Specify the handoff time.",
            },
          ],
          nextStep: "Add a concrete handoff time.",
          characterReply: "Could you send the final figures by 10 AM?",
        },
      },
    });
  });
  await page.goto("/my-courses");
  await page.getByRole("button", { name: document.title, exact: true }).click();
  await page
    .getByRole("button", { name: "Student preview", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Your response", exact: true })
    .fill("I can finish the structure Wednesday.");
  await page
    .getByRole("button", { name: "Submit response", exact: true })
    .click();
  await expect(
    page.getByText("Add a concrete handoff time.", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Your response", exact: true })
    .fill("I will send the final figures Thursday at 10 AM.");
  await page
    .getByRole("button", {
      name: "Submit improvement",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("2 recorded preview attempt(s)", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath("student-preview.png"),
    fullPage: true,
  });
  expect(submissions).toHaveLength(2);
  expect(submissions.every((s) => s.preview)).toBe(true);
});
