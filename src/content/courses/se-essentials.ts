import type { Course } from "@/lib/types";
import {
  choice,
  codeReview,
  conversation,
  ordering,
  reading,
  simulation,
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
        simulation("release-priority", {
          schemaVersion: 1,
          title: "Prioritise the first release",
          scenario: {
            description:
              "You have just finished the clinic interview. The manager wants fewer missed morning appointments, but there is no agreed product yet. You have one small delivery team and a fixed date for a pilot.",
            objectives: [
              "Choose a first increment that respects the clinic constraints",
              "Balance customer value against delivery effort and trust",
              "Explain the trade-off behind the decision",
            ],
            initialSituation:
              "The clinic books appointments in a shared spreadsheet. Two reception staff share one desk, mornings are busiest, the budget is small, and nobody has approved a patient-facing app. Your team can deliver one small increment before the pilot date.",
            participantRole:
              "You are the product lead for a two-week discovery and delivery cycle.",
            persona:
              "The clinic manager (cautious, budget-conscious) and a solo developer (optimistic about scope).",
          },
          variables: [
            {
              id: "value",
              type: "number",
              label: "Customer value",
              initial: 0,
              min: 0,
              max: 10,
              unit: "pts",
              visible: true,
              description: "How much the increment improves the morning queue.",
            },
            {
              id: "effort",
              type: "number",
              label: "Delivery effort",
              initial: 0,
              min: 0,
              max: 10,
              unit: "pts",
              visible: true,
              description: "Work the small team must absorb before the pilot date.",
            },
            {
              id: "trust",
              type: "number",
              label: "Stakeholder trust",
              initial: 5,
              min: 0,
              max: 10,
              visible: true,
              description: "The manager's confidence that you will deliver what you promise.",
            },
            {
              id: "scope",
              type: "enum",
              label: "Committed scope",
              initial: "unset",
              options: ["unset", "shared-view", "full-app"],
              visible: true,
            },
            {
              id: "risk",
              type: "enum",
              label: "Biggest known risk",
              initial: "unclear",
              options: ["unclear", "scope-creep", "technical"],
              visible: true,
            },
          ],
          startStage: "triage",
          stages: [
            {
              id: "triage",
              title: "Choose the first move",
              narrative:
                "The manager asks what you can show before the pilot. You have not promised a mobile app. What do you commit to?",
              actions: [
                {
                  id: "shared-view",
                  label: "Ship a shared availability view",
                  description:
                    "Reception keeps owning bookings, but everyone can see which morning slots are taken.",
                  effects: [
                    { op: "add", variable: "value", value: 4 },
                    { op: "add", variable: "effort", value: 3 },
                    { op: "set", variable: "scope", value: "shared-view" },
                  ],
                  feedback:
                    "You choose the smallest change that addresses the visible problem. Effort stays manageable and the manager can still correct the design.",
                  nextStage: "review",
                },
                {
                  id: "full-app",
                  label: "Promise the full patient app",
                  description:
                    "Accounts, reminders and payments, delivered before the pilot.",
                  effects: [
                    { op: "add", variable: "value", value: 6 },
                    { op: "add", variable: "effort", value: 9 },
                    { op: "add", variable: "trust", value: -3 },
                    { op: "set", variable: "scope", value: "full-app" },
                    { op: "set", variable: "risk", value: "scope-creep" },
                  ],
                  feedback:
                    "The promise is attractive but large. You spent effort you do not have and signalled that you will deliver beyond the agreed budget.",
                  nextStage: "review",
                },
                {
                  id: "more-discovery",
                  label: "Run one more discovery session",
                  description:
                    "Spend a day with reception before committing to any build.",
                  effects: [
                    { op: "add", variable: "trust", value: 2 },
                    { op: "add", variable: "effort", value: 1 },
                  ],
                  feedback:
                    "You buy information instead of guessing. It costs a little effort but gives the team evidence for the next decision.",
                  nextStage: "discovery",
                },
              ],
            },
            {
              id: "discovery",
              title: "What the desk actually needs",
              narrative:
                "A day with reception shows that most missed appointments happen when two people edit the same row at once. The manager still cannot approve a patient app, but a shared view would remove the double-booking.",
              actions: [
                {
                  id: "cut-scope",
                  label: "Cut scope to the shared view",
                  description:
                    "Keep the promise small and test the workflow with reception first.",
                  effects: [
                    { op: "add", variable: "value", value: 4 },
                    { op: "add", variable: "effort", value: 3 },
                    { op: "set", variable: "scope", value: "shared-view" },
                    { op: "set", variable: "risk", value: "technical" },
                  ],
                  feedback:
                    "The evidence supports a narrow, testable change. You name the remaining technical risk instead of hiding it.",
                  nextStage: "review",
                },
                {
                  id: "promise-everything",
                  label: "Promise the full app anyway",
                  description:
                    "Use the discovery meeting to push the original patient app.",
                  effects: [
                    { op: "add", variable: "value", value: 6 },
                    { op: "add", variable: "effort", value: 9 },
                    { op: "add", variable: "trust", value: -4 },
                    { op: "set", variable: "scope", value: "full-app" },
                  ],
                  feedback:
                    "You heard a real constraint and still committed beyond it. The manager now expects a product the budget cannot support.",
                  nextStage: "review",
                },
              ],
            },
            {
              id: "review",
              title: "Before the pilot",
              narrative:
                "The pilot date is close. Review what you committed to and choose a responsible next step.",
              actions: [
                {
                  id: "release-and-measure",
                  label: "Release the shared view and measure the queue",
                  availableWhen: {
                    kind: "compare",
                    variable: "scope",
                    op: "eq",
                    value: "shared-view",
                  },
                  description:
                    "Measure missed appointments for two weeks and agree what would count as success.",
                  effects: [
                    { op: "add", variable: "value", value: 2 },
                    { op: "add", variable: "trust", value: 2 },
                  ],
                  feedback:
                    "You ship a small increment with a measurable outcome. The manager can judge it on evidence, not on a promise.",
                  nextStage: "success-ending",
                },
                {
                  id: "pilot",
                  label: "Run a one-week staff pilot before releasing",
                  availableWhen: {
                    kind: "compare",
                    variable: "scope",
                    op: "eq",
                    value: "shared-view",
                  },
                  description:
                    "Let reception use the shared view in parallel with the spreadsheet.",
                  effects: [
                    { op: "add", variable: "trust", value: 1 },
                    { op: "add", variable: "effort", value: 2 },
                  ],
                  feedback:
                    "You trade a week of effort for lower operational risk. The cautious choice is defensible, but the queue does not improve yet.",
                  nextStage: "partial-ending",
                },
                {
                  id: "add-accounts",
                  label: "Add patient accounts before releasing",
                  availableWhen: {
                    kind: "compare",
                    variable: "scope",
                    op: "eq",
                    value: "full-app",
                  },
                  description:
                    "Stretch the team further to make the big promise look complete.",
                  effects: [
                    { op: "add", variable: "effort", value: 4 },
                    { op: "add", variable: "trust", value: -1 },
                    { op: "set", variable: "risk", value: "scope-creep" },
                  ],
                  feedback:
                    "Every extra feature adds risk to the pilot. The core queue problem is still unmeasured.",
                  nextStage: "failure-ending",
                },
              ],
            },
            {
              id: "success-ending",
              title: "A measurable first release",
              narrative:
                "The shared view ships on time. Reception can see the morning slots at a glance, and the manager has a number to watch.",
              actions: [],
              ending: {
                outcome: "success",
                summary:
                  "You chose the smallest increment that addressed the real problem, respected the budget, and gave the clinic evidence for the next decision.",
              },
            },
            {
              id: "partial-ending",
              title: "Safe, but not yet better",
              narrative:
                "The pilot runs without incidents, but the morning queue is unchanged because the team is still learning the new view.",
              actions: [],
              ending: {
                outcome: "partial",
                summary:
                  "You protected operational trust but delayed the customer outcome. A second week with a clear success measure would turn the pilot into evidence.",
              },
            },
            {
              id: "failure-ending",
              title: "The promise outruns the team",
              narrative:
                "The pilot date arrives with accounts half-built and the original double-booking still happening. The manager asks why the team did not start smaller.",
              actions: [],
              ending: {
                outcome: "failure",
                summary:
                  "The commitment exceeded the constraints you had already heard. A narrow, testable increment would have reduced risk and preserved trust.",
              },
            },
          ],
          completion: {
            maxSteps: 5,
            rules: [],
            exhaustedSummary:
              "The pilot date passed without a final decision. In practice, a first release needs an explicit scope and a measurable outcome.",
          },
          rubric: [
            {
              id: "evidence",
              criterion: "Chooses an increment supported by what the clinic said",
              description: "The decision follows from the interview facts, not a preferred technology.",
            },
            {
              id: "constraints",
              criterion: "Respects effort, budget and trust",
              description: "The plan is deliverable by the team that exists.",
            },
            {
              id: "outcome",
              criterion: "Defines how success will be measured",
              description: "The release has a visible effect on the morning queue.",
            },
            {
              id: "trade-off",
              criterion: "Names the risk being accepted",
              description: "The recommendation is honest about what is still unknown.",
            },
          ],
          debrief: {
            success:
              "You separated the request from the problem and delivered the smallest change that could be evaluated. That is the core of prioritisation: value, effort and trust are traded explicitly.",
            partial:
              "Your caution was reasonable, but a pilot without a success measure is only a delay. Decide in advance which number would tell you the queue improved.",
            failure:
              "A large promise made the team's constraints disappear on paper, not in reality. Starting with a narrow workflow would have produced evidence at a fraction of the effort.",
            incomplete:
              "The scenario ended before a release decision. In a real project, an explicit first increment and a success measure matter more than keeping every option open.",
          },
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
