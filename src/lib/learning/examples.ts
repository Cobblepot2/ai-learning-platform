import { newCourse, type CourseDocument } from "./model";
/** Optional teaching examples, never platform-wide defaults. Both use the same
 * registered response mechanism and the same editor, API and student renderer. */
export function exampleCourse(subject: "software" | "english"): CourseDocument {
  const software = subject === "software";
  const title = software
    ? "Requirements conversations"
    : "English for collaborative negotiation";
  const objective = software
    ? "Ask questions that uncover constraints before proposing a solution"
    : "Clarify interests and propose a polite, mutually useful compromise";
  return {
    ...newCourse(),
    title,
    domain: software ? "Software Engineering" : "English Communication",
    tagline: "Practise, receive feedback, then improve.",
    description: software
      ? "Software engineering fundamentals, stakeholder communication and product decisions."
      : "Use clarification, paraphrasing and collaborative language in a workplace negotiation.",
    targetAudience: "University students",
    objectives: [objective],
    estimatedMinutes: 15,
    lessons: [
      {
        id: crypto.randomUUID(),
        title,
        minutes: 15,
        summary: "A worked explanation followed by practice and revision.",
        objectives: [objective],
        blocks: [
          {
            type: "activity",
            id: crypto.randomUUID(),
            version: 1,
            activityType: "reading",
            config: {
              markdown: software
                ? "## Understand the need before the solution\nA request such as “build an app” is not a requirement. Ask who experiences the problem, when it happens, how people cope now and what a successful outcome looks like. Separate constraints (budget, access, timing) from proposed features. Summarise what you heard and ask the stakeholder to correct it.\n\nExample: “When does booking become difficult, and how do you handle a cancelled appointment today?” is more informative than “Do you want a mobile app?”"
                : "## Negotiate interests, not just positions\nA position says what someone wants; an interest explains why. Ask open questions, paraphrase the answer, and offer a conditional compromise.\n\nUseful language: “Could you tell me what makes that deadline important?”, “If I understand correctly, your main concern is…”, and “Would it work if we…?”\n\nAvoid promises you cannot keep. State the trade-off clearly and confirm agreement.",
            },
          },
          {
            type: "activity",
            id: crypto.randomUUID(),
            version: 1,
            activityType: "response",
            config: {
              title: software
                ? "Meet the clinic manager"
                : "Negotiate a presentation deadline",
              mode: "roleplay",
              task: software
                ? "Ask two focused questions, explain what uncertainty each resolves, then respond to the manager’s reply."
                : "Write your opening response in English. Ask about your teammate’s concern, propose a conditional compromise, and revise after feedback.",
              context: software
                ? "A small clinic wants a booking app. Its reception team currently uses a shared spreadsheet. The budget is limited and staff are busiest in the morning. Do not assume an app is the only solution."
                : "Your team presentation is due Friday. Your teammate wants every slide finished Wednesday because they work Thursday. You need Thursday morning to verify the final figures. You can finish the structure and most slides Wednesday.",
              persona: software
                ? "A clinic manager who values short waiting times and needs an affordable solution. Respond to the learner’s actual questions using the stated facts; identify assumptions instead of inventing requirements."
                : "A cooperative teammate who cannot work Thursday. Explain your concern, respond naturally to the proposal and ask for a clear handoff plan.",
              rubric: software
                ? [
                    "Asks open questions grounded in the clinic context",
                    "Separates the underlying need from a proposed app",
                    "Identifies constraints and summarises next steps",
                  ]
                : [
                    "Uses polite, natural English",
                    "Acknowledges the teammate’s scheduling constraint",
                    "Offers a feasible compromise with a clear handoff",
                  ],
            },
          },
        ],
      },
    ],
  };
}
