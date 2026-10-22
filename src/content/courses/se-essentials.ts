import type { Course } from "@/lib/types";
import {
  choice,
  codeReview,
  conversation,
  ordering,
  reading,
} from "./authoring";

export const seEssentials: Course = {
  id: "se-essentials",
  title: "Software Engineering Essentials",
  tagline: "From a vague idea to software people can actually use",
  description:
    "How real teams turn an idea into working software: the lifecycle, talking to stakeholders, and catching problems before users do. No coding experience needed.",
  level: "Beginner",
  audience: ["non_cs", "career_switcher", "cs_student"],
  emoji: "🧭",
  lessons: [
    {
      id: "lifecycle",
      title: "How software actually gets built",
      summary: "The software development lifecycle, and why skipping steps gets expensive.",
      minutes: 10,
      blocks: [
        reading(
          "intro",
          `## Code is the easy part

Picture a café owner who asks a friend to "make an app for online orders." The friend codes for two weeks and shows the result. The owner frowns: *"Where do customers pick a pickup time? And I need to stop orders when we're busy."*

The code was fine. The **understanding** was wrong.

Software engineering is the discipline of building the *right* thing, building it *well*, and keeping it working. Most teams follow some version of the **software development lifecycle (SDLC)**:

| Stage | Key question |
|---|---|
| **Requirements** | What problem are we solving, and for whom? |
| **Design** | How will the pieces fit together? |
| **Implementation** | Writing the code (increasingly with AI help) |
| **Testing** | Does it do what we promised, and nothing harmful? |
| **Deployment** | How do real users get it? |
| **Maintenance** | How do we fix, improve and keep it running? |

Modern teams loop through these stages in short cycles (often called *agile* or *iterative* development) instead of doing each once.`,
        ),
        ordering(
          "order-sdlc",
          "Put the stages of the lifecycle in order for one iteration.",
          ["Requirements", "Design", "Implementation", "Testing", "Deployment", "Maintenance"],
          "Each stage depends on the one before it: you can't test against requirements you never wrote down, and you can't deploy what hasn't been tested.",
        ),
        reading(
          "cost",
          `## The cost of a late surprise

A misunderstanding caught while talking to the café owner costs a five-minute conversation. The same misunderstanding caught after launch can mean redesigning screens, migrating data and apologising to customers.

That is why experienced engineers spend so much time **asking questions** before writing code. AI coding tools make implementation faster, which makes this even more true: if building is cheap, building the *wrong* thing is the main way to waste time.`,
        ),
        choice(
          "quiz-cost",
          "A team discovers after launch that users need to pay in two currencies. Where was this most cheaply caught?",
          ["During testing", "During requirements", "During deployment", "During maintenance"],
          1,
          "Payment currencies are a requirement. Asking the right questions up front costs minutes; changing a live payment system costs weeks.",
        ),
        choice(
          "quiz-ai",
          "AI coding agents mainly speed up which stage?",
          ["Requirements", "Implementation", "Talking to stakeholders", "Deciding what to build"],
          1,
          "AI is very good at turning a clear description into code. Deciding *what* to build and *why* still depends on human judgment and on talking to users.",
        ),
      ],
    },
    {
      id: "requirements",
      title: "Requirements: interview a real client",
      summary: "Practise uncovering what a client really needs, with an AI playing the client.",
      minutes: 15,
      blocks: [
        reading(
          "intro",
          `## Clients don't hand you a spec

People describe **solutions** ("I need an app") rather than **problems** ("I lose orders when the phone rings during the lunch rush"). Your job is to dig underneath.

Good requirement questions are:

- **Open:** "Walk me through a typical busy day" beats "Do you get busy?"
- **About the past, not hypotheticals:** "What happened the last time an order went wrong?"
- **About people:** who uses it, who pays, who maintains it?
- **About constraints:** budget, deadline, devices, rules and regulations.

Requirements are usually split into **functional** (what the system does: "customers can choose a pickup time") and **non-functional** (how well it does it: "the menu loads in under 2 seconds on a phone").`,
        ),
        choice(
          "quiz-nfr",
          "Which of these is a non-functional requirement?",
          [
            "Customers can cancel an order",
            "The owner can mark an item as sold out",
            "The app works on phones that are five years old",
            "Customers receive a receipt by email",
          ],
          2,
          "Supporting older phones describes a quality of the system (compatibility and performance), not a feature the user directly uses.",
        ),
        conversation("interview-cafe", {
          title: "Interview Mrs. Chan, the café owner",
          scenario:
            "Mrs. Chan runs a small café in Hung Hom. She wants 'an ordering app'. Interview her to find out what she really needs. There are several important details she won't mention unless you ask good questions.",
          persona:
            "You are Mrs. Chan, 52, owner of a 20-seat café near a university in Hung Hom, Hong Kong. You are friendly, busy and not technical. You speak in short, natural sentences and sometimes drift into stories about your customers. You describe solutions ('I want an app like the big chains') rather than problems. Only reveal a hidden detail when the learner asks a question that reasonably leads to it; never list them all at once. Hidden details: (1) phone orders during the 12:00-13:30 lunch rush get lost or written down wrong; (2) most customers are students who order in groups and want to split the bill; (3) her budget is under HK$20,000 and she wants it before the September semester starts; (4) her staff are two part-time students, so the system must be learnable in 10 minutes; (5) she needs to stop new orders when the kitchen is overloaded; (6) payment must support Octopus and FPS because many students don't use credit cards.",
          goals: [
            "Uncover the real ordering problem before discussing solutions",
            "Ask about the people who will use and run the system",
            "Ask about budget, deadline and operational constraints",
            "Summarise the needs back to the owner in your own words",
          ],
          rubric: [
            "Asks open questions before proposing a solution",
            "Uncovers at least three specific requirements",
            "Checks a budget, deadline or operational constraint",
            "Summarises the needs back to the owner",
          ],
          opening:
            "Ah, hello, hello! Sit, sit. So my nephew says you can make me an app? Like the big coffee chains have. How much does something like that cost?",
          minTurns: 4,
        }),
        reading(
          "wrap",
          `## From interview to user stories

Teams often write requirements as **user stories**:

> As a **student ordering for a group**, I want to **split the bill in the app** so that **we don't have to sort out change at the counter**.

The format forces you to name *who* benefits and *why*, which helps the team decide what to build first. Try turning one thing you learned from Mrs. Chan into a user story in your notes.`,
        ),
      ],
    },
    {
      id: "testing",
      title: "Testing: catch it before users do",
      summary: "Why testing matters, the main kinds of tests, and a bug hunt.",
      minutes: 10,
      blocks: [
        reading(
          "intro",
          `## Testing is a safety net

Every change to software can break something that used to work. Tests are small programs that check the software still behaves as promised, so the team can change things with confidence.

- **Unit tests** check one small piece, such as "the total price function adds 10% service charge".
- **Integration tests** check that pieces work together, such as "placing an order saves it to the database".
- **End-to-end tests** act like a real user clicking through the app.
- **User acceptance testing** puts the software in front of the people who asked for it.

A useful habit is to test the **edges**: zero items, a huge order, a negative number, an empty name. Bugs love edges.`,
        ),
        codeReview(
          "bug-total",
          "This function calculates a café bill split between friends. Click the line you think contains the bug. (You don't need to know the language: read it like a recipe.)",
          "python",
          `def split_bill(total, people, service_charge=0.10):
    if total < 0:
        raise ValueError("total cannot be negative")
    total_with_service = total * (1 + service_charge)
    share = total_with_service / people
    return round(share, 2)`,
          [5],
          "Nothing stops `people` from being 0, so splitting a bill between zero people crashes with a division-by-zero error. A good test would try `split_bill(100, 0)` and the function should check `people > 0` first.",
        ),
        choice(
          "quiz-edge",
          "Which test input is most likely to reveal a bug in split_bill?",
          ["total=100, people=4", "total=88.5, people=3", "total=100, people=0", "total=200, people=2"],
          2,
          "The first, second and fourth are ordinary cases. Zero people is an edge case, and edge cases are where bugs hide.",
        ),
      ],
    },
  ],
};
