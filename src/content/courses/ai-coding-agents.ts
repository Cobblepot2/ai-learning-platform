import type { Course } from "@/lib/types";
import { choice, codeReview, ordering, reading, response } from "./authoring";

export const aiCodingAgents: Course = {
  id: "ai-coding-agents",
  title: "Building Software with AI Coding Agents",
  tagline: "Delegate, describe, discern and take responsibility",
  description:
    "AI agents can now write most of the code. This course is about everything else: deciding what to hand over, describing it clearly, and judging whether the output is any good. Uses Anthropic's AI Fluency 4D framework.",
  level: "Beginner – Intermediate",
  audience: ["non_cs", "cs_student", "cs_graduate", "career_switcher"],
  emoji: "🤖",
  lessons: [
    {
      id: "four-ds",
      title: "The 4D framework for working with AI",
      summary: "Delegation, Description, Discernment and Diligence.",
      minutes: 10,
      blocks: [
        reading(
          "intro",
          `## Coding got cheap. Judgment didn't.

An AI coding agent can read a project, write code, run it and fix its own errors. What it can't do is know what you actually want, or take responsibility for what gets shipped.

Anthropic's **AI Fluency** framework describes four competencies for working with AI effectively, efficiently and responsibly:

| | Competency | In practice |
|---|---|---|
| 🎯 | **Delegation** | Deciding which tasks to hand to AI, which to keep, and which to split |
| ✍️ | **Description** | Clearly specifying goals, context, constraints and what "done" looks like |
| 🔍 | **Discernment** | Critically evaluating the AI's output and reasoning |
| 🛡️ | **Diligence** | Verifying, documenting and taking accountability for the result |

The rest of this course practises each one.`,
        ),
        choice(
          "quiz-delegation",
          "Your team is building a booking app. Which task is the best candidate to delegate fully to an AI agent?",
          [
            "Deciding whether users should pay a deposit",
            "Writing the form that validates email addresses",
            "Choosing which customers to interview",
            "Signing off that the app is ready for launch",
          ],
          1,
          "Email validation is well-defined, easy to check and low-risk: ideal for delegation. The others involve product judgment or accountability that should stay with people.",
        ),
        choice(
          "quiz-diligence",
          "An agent says 'All tests pass ✅'. What does Diligence ask you to do next?",
          [
            "Ship it: the agent checked",
            "Ask the agent if it is sure",
            "Run the tests yourself and check the tests actually cover the change",
            "Delete the tests to save time",
          ],
          2,
          "Agents can be wrong about their own work, or write tests that don't really test anything. You are accountable for what ships, so verify independently.",
        ),
        ordering(
          "order-4d",
          "Order the 4Ds as they usually happen on a single task.",
          ["Delegation", "Description", "Discernment", "Diligence"],
          "First decide what to hand over, then describe it, then evaluate the output, then verify and own the result. In practice you loop through them many times.",
        ),
      ],
    },
    {
      id: "description",
      title: "Description: write a spec an agent can't misread",
      summary: "Turn a vague request into a clear task description, with AI feedback.",
      minutes: 15,
      blocks: [
        reading(
          "intro",
          `## "Make it better" is not a spec

Compare two requests to a coding agent:

> ❌ *Add a login page.*

> ✅ *Add an email + password login page at \`/login\` using our existing Supabase client in \`lib/supabase.ts\`. Show an inline error for a wrong password. Don't add social login yet. Done means: I can log in with the test account in \`seed.sql\`, and a wrong password shows the error without reloading the page.*

The second one states:

1. **Goal**: what should exist afterwards
2. **Context**: files, tools and conventions to use
3. **Constraints**: what *not* to do
4. **Definition of done**: how you'll check it worked

You don't need to know how to code to write the good version. You need to know what you want.`,
        ),
        response("lab-spec", {
          title: "Write a task description for an AI coding agent",
          task:
            "Mrs. Chan's café app needs a feature that lets the owner pause new orders when the kitchen is overloaded. Write the task description you would give an AI coding agent.",
          context:
            "A weak first attempt: “Add a button to stop orders.” Use the four parts above: goal, context, constraints and definition of done.",
          persona: "",
          rubric: [
            "States the goal from the user's point of view (who uses it and why)",
            "Gives useful context (where it lives in the app, who can see it)",
            "Includes at least one constraint or thing not to do",
            "Covers what customers see while orders are paused",
            "Has a checkable definition of done",
          ],
          mode: "writing",
        }),
      ],
    },
    {
      id: "discernment",
      title: "Discernment: review AI-generated code",
      summary: "AI output often looks right. Practise spotting where it isn't.",
      minutes: 10,
      blocks: [
        reading(
          "intro",
          `## Confident is not the same as correct

AI-generated code is usually tidy, well-named and commented, which makes mistakes easy to miss. Common problems to look for:

- **Plausible but wrong logic**: off-by-one errors, wrong comparison signs
- **Missing edge cases**: empty input, zero, very large numbers
- **Security holes**: trusting user input, exposing secrets
- **Invented APIs**: calling functions or libraries that don't exist
- **Scope creep**: changing things you didn't ask for

Reading code critically is a skill you can build even without writing much code yourself.`,
        ),
        codeReview(
          "review-discount",
          "You asked an agent: 'Give students 10% off orders of HK$50 or more.' It produced this. Click the line with the bug.",
          "javascript",
          `// Apply student discount to an order total (HK$)
function applyStudentDiscount(total, isStudent) {
  const DISCOUNT = 0.1;
  const MIN_ORDER = 50;
  if (isStudent && total > MIN_ORDER) {
    return total * (1 - DISCOUNT);
  }
  return total;
}`,
          [5],
          "The request said 'HK$50 or more', but `total > MIN_ORDER` excludes exactly HK$50. It should be `>=`. A test for the boundary value 50 would have caught this.",
        ),
        codeReview(
          "review-secret",
          "The agent added code to the website to call the AI tutor. Something here is a security problem. Click the line.",
          "javascript",
          `async function askTutor(question) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": "sk-ant-api03-REAL-KEY-HERE",
      "content-type": "application/json",
    },
    body: JSON.stringify({ question }),
  });
  return response.json();
}`,
          [5],
          "The secret API key is written into code that runs in the browser, so anyone can open developer tools and copy it. Keys belong on the server, and the browser should call your own backend instead.",
        ),
        choice(
          "quiz-discern",
          "What's the most reliable way to catch the discount bug above?",
          [
            "Ask the AI to double-check its code",
            "Write a test with total exactly 50",
            "Read the comments carefully",
            "Use a different AI model",
          ],
          1,
          "A test at the boundary value checks behaviour directly. Asking the AI again can help, but it may confidently repeat the same mistake.",
        ),
      ],
    },
  ],
};
