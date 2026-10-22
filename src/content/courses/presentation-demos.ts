import type { Course } from "@/lib/types";
import {
  conversation,
  ordering,
  quiz,
  reading,
  response,
  simulation,
} from "./authoring";

/** Published static demos for the group presentation. Same activity registry as teacher-authored courses. */
export const presentationDemos: Course[] = [
  {
    id: "demo-se-requirements",
    title: "Scenario A · Requirements interview and a development decision",
    tagline: "Ask better questions, then choose what to build.",
    description:
      "A software-engineering clinic: practise a stakeholder interview, separate needs from solution ideas, and defend a development decision. Uses the same reading, quiz, ordering, conversation and guided-response activities as any other subject.",
    domain: "Software Engineering",
    targetAudience: "University students learning software engineering",
    prerequisites: ["No programming is required"],
    objectives: [
      "Uncover constraints before proposing a solution",
      "Hold a short requirements interview",
      "Choose and justify a development option",
    ],
    language: "English",
    level: "Beginner",
    estimatedMinutes: 35,
    emoji: "🧭",
    audience: ["general", "non_cs", "cs_student", "career_switcher"],
    lessons: [
      {
        id: "se-req-foundations",
        title: "Before the interview",
        summary: "What a requirement is, and the order of a useful conversation.",
        minutes: 10,
        objectives: [
          "Separate the problem from a proposed feature",
          "Order the moves in a requirements interview",
        ],
        blocks: [
          reading(
            "se-req-reading",
            `## A request is not a requirement

“Build us an app” names a solution. A requirement names who has the problem, when it happens, what they do today, and what would count as better.

Keep four notes while you listen:

| Note | Question it answers |
|---|---|
| User and situation | Who feels this, and when? |
| Current workaround | How do people cope today? |
| Constraint | What cannot change (time, money, access, policy)? |
| Success | What would the stakeholder point at and call an improvement? |

Do not promise a product in the first conversation. Summarise what you heard and let the stakeholder correct you.`,
          ),
          quiz("se-req-quiz", "Spot the requirement", [
            {
              question: "Which note is a requirement rather than a solution?",
              options: [
                "Build a native mobile app",
                "Reception cannot see which morning slots are already taken",
                "Use a cloud database",
                "Add a chatbot",
              ],
              answer: 1,
              explanation:
                "The reception problem is observable. The other three jump to an implementation.",
            },
            {
              question: "A stakeholder says the budget is small and mornings are busiest. What are those?",
              options: [
                "Nice-to-have features",
                "Constraints that any option must respect",
                "Proof that an app is required",
                "Test cases",
              ],
              answer: 1,
              explanation:
                "Budget and peak time constrain the design. They do not by themselves choose the technology.",
            },
          ]),
          ordering(
            "se-req-order",
            "Put a first stakeholder meeting in a useful order.",
            [
              "Ask who has the problem and when it happens",
              "Ask how people cope today",
              "Ask what must not get worse",
              "Summarise and ask the stakeholder to correct you",
              "Only then sketch possible approaches",
            ],
            "Discovery comes before a proposal. A summary gives the stakeholder a chance to fix your notes.",
          ),
        ],
      },
      {
        id: "se-req-interview",
        title: "Interview the clinic manager",
        summary: "A three-turn conversation. Follow what the manager actually says.",
        minutes: 15,
        objectives: [
          "Ask open questions grounded in the clinic",
          "Revise the next question after each reply",
        ],
        blocks: [
          reading(
            "se-req-interview-brief",
            `## Your brief

A neighbourhood clinic wants help with appointments. You have not been told to build an app. You are about to meet the manager.

Use the conversation to learn who is affected, what the morning looks like, and what a smaller change would have to respect. Do not pitch a product in your first question.`,
          ),
          conversation("se-req-interview-chat", {
            title: "Clinic manager",
            scenario:
              "A small clinic books appointments in a shared spreadsheet. Mornings are the busiest. The budget is limited. Two reception staff share one desk. The manager has not decided that a mobile app is the answer.",
            persona:
              "You are the clinic manager. You care about shorter morning queues and not adding work for reception. Answer only from these facts: bookings live in a spreadsheet, two people share one desk, mornings are busiest, the budget is small, and staff will not adopt a tool that needs a long training. If the student assumes an app, say you are not sure that is affordable and ask what problem they are trying to solve. Keep replies to one to four sentences. Do not invent patient data or new budget figures.",
            goals: [
              "Ask who feels the problem and when",
              "Find the current workaround and one constraint",
              "Summarise what you heard before suggesting anything",
            ],
            rubric: [
              "Asks open questions grounded in the clinic",
              "Responds to the manager instead of repeating a script",
              "Separates the need from a proposed app",
            ],
            opening:
              "Thanks for coming in. Mornings at the desk are hectic — what do you need from me?",
            minTurns: 3,
          }),
        ],
      },
      {
        id: "se-req-decision",
        title: "Choose what to build first",
        summary: "Use the interview facts to justify a first development step.",
        minutes: 10,
        objectives: ["Justify a first increment against the constraints you heard"],
        blocks: [
          reading(
            "se-req-decision-reading",
            `## Three options, one first step

After the interview you still have the same facts: a shared spreadsheet, a busy morning, a small budget, and two people at one desk.

| Option | What it is |
|---|---|
| A | A shared view that shows which morning slots are taken, still edited by reception |
| B | A patient mobile app with accounts, reminders and payments |
| C | Do nothing until a vendor demo |

Pick a first step and say what evidence would make you change your mind.`,
          ),
          response("se-req-decision-response", {
            title: "Recommend a first increment",
            mode: "scenario",
            task: "Choose A, B or C. Name the constraint it respects, the risk you are accepting, and what you would check in the next two weeks.",
            context:
              "Clinic facts you may use: spreadsheet bookings, two reception staff, one shared desk, busy mornings, small budget, no decision yet that a mobile app is required. Do not invent usage numbers.",
            persona:
              "A senior engineer who asks follow-up questions when the recommendation ignores a stated constraint.",
            rubric: [
              "Chooses an option and ties it to a clinic constraint",
              "Names a risk or what would change the decision",
              "Describes a concrete next check rather than a full product",
            ],
          }),
        ],
      },
    ],
  },
  {
    id: "demo-english-negotiation",
    title: "Scenario B · English workplace negotiation",
    tagline: "Clarify, acknowledge the constraint, then offer a compromise.",
    description:
      "An English communication clinic for a scheduling disagreement. No code and no software-engineering template: reading, a short quiz, ordering, a multi-turn conversation, and a written agreement.",
    domain: "English Communication",
    targetAudience: "University students practising workplace English",
    prerequisites: ["Comfortable reading a short English dialogue"],
    objectives: [
      "Use polite clarification and paraphrasing",
      "Acknowledge a scheduling constraint",
      "Propose a feasible compromise and confirm it in writing",
    ],
    language: "English",
    level: "Beginner",
    estimatedMinutes: 30,
    emoji: "💬",
    audience: ["general", "non_cs", "career_switcher"],
    lessons: [
      {
        id: "en-neg-language",
        title: "Interests, not only positions",
        summary: "Language for asking, paraphrasing and offering a conditional compromise.",
        minutes: 10,
        objectives: ["Choose polite, specific English for a scheduling disagreement"],
        blocks: [
          reading(
            "en-neg-reading",
            `## Positions and interests

A **position** is what someone asks for: “Finish every slide on Wednesday.”
An **interest** is why: “I cannot work on Thursday.”

Useful moves:

1. **Clarify** — “Could you tell me what makes Wednesday important?”
2. **Paraphrase** — “If I understand correctly, your main concern is …”
3. **Conditional offer** — “Would it work if we …?”
4. **Confirm** — “So we are agreeing that …”

Avoid promising work you cannot finish. Name the trade-off in one sentence.`,
          ),
          quiz("en-neg-quiz", "Choose the more useful reply", [
            {
              question:
                "Your teammate says, “I need every slide on Wednesday because I work Thursday.” Which reply acknowledges the interest?",
              options: [
                "No, Wednesday is impossible.",
                "If I understand correctly, Thursday is not available for you. Is that the main concern?",
                "You should manage your time better.",
                "Whatever. I will do it all.",
              ],
              answer: 1,
              explanation:
                "The paraphrase checks the interest before you argue about the day.",
            },
            {
              question: "Which offer is a conditional compromise?",
              options: [
                "I will try.",
                "Would it work if I send the structure and most slides Wednesday, and the checked figures Thursday morning?",
                "That is your problem.",
                "Let’s cancel the presentation.",
              ],
              answer: 1,
              explanation:
                "“Would it work if…” names a concrete trade-off the other person can accept or adjust.",
            },
          ]),
          ordering(
            "en-neg-order",
            "Put the negotiation moves in a cooperative order.",
            [
              "Ask what makes the other person’s deadline important",
              "Paraphrase their constraint",
              "Offer a conditional compromise",
              "Confirm who does what, and when",
            ],
            "Ask and paraphrase before you offer. End by confirming the handoff so you are not agreeing to two different plans.",
          ),
        ],
      },
      {
        id: "en-neg-conversation",
        title: "Negotiate the presentation deadline",
        summary: "Three turns with a teammate who cannot work on Thursday.",
        minutes: 12,
        objectives: [
          "Respond to what your teammate says",
          "Reach a handoff you can both keep",
        ],
        blocks: [
          conversation("en-neg-chat", {
            title: "Teammate",
            scenario:
              "The team presentation is due Friday. Your teammate wants every slide finished on Wednesday because they work all day Thursday. You need Thursday morning to verify the final figures. You can finish the structure and most slides on Wednesday.",
            persona:
              "You are a cooperative teammate who cannot work on Thursday. You want a clear handoff, not a winner. If the student ignores your Thursday constraint, repeat it politely and ask who checks the figures. If they offer a realistic split, accept the workable part and ask them to confirm the times. Speak in natural workplace English, one to four sentences. Do not switch into a software lecture.",
            goals: [
              "Ask about the Thursday constraint",
              "Acknowledge it before proposing a change",
              "Offer a handoff you can actually finish",
            ],
            rubric: [
              "Uses polite, natural English",
              "Acknowledges the Thursday constraint",
              "Offers a feasible compromise with a clear handoff",
            ],
            opening:
              "Can we lock the slides on Wednesday? I am at work all day Thursday, so Friday morning will be too late for me to review them.",
            minTurns: 3,
          }),
        ],
      },
      {
        id: "en-neg-agreement",
        title: "Write the agreement",
        summary: "Turn the conversation into a short confirmation your teammate can rely on.",
        minutes: 8,
        objectives: ["Confirm owners, times and the open risk in polite English"],
        blocks: [
          response("en-neg-email", {
            title: "Confirmation message",
            mode: "writing",
            task: "Write a short message to your teammate. Paraphrase their constraint, state the compromise, and name who sends what and when.",
            context:
              "Facts you can use: presentation due Friday; teammate unavailable Thursday; you can send the structure and most slides Wednesday; figures need Thursday morning; you will send the checked figures Thursday at 11:00. Do not promise a finished slide deck on Wednesday night.",
            persona: "",
            rubric: [
              "Politely restates the teammate’s constraint",
              "States a compromise that matches the facts",
              "Names the handoff time clearly",
            ],
          }),
        ],
      },
    ],
  },
  {
    id: "demo-business-negotiation",
    title: "Scenario C · Supplier negotiation",
    tagline: "Trade price, reliability and relationship in one live decision.",
    description:
      "A business-negotiation clinic using the same simulation schema and engine as the software-engineering demo. Renew a supplier contract by choosing what to prioritise, when to reveal information, and what kind of deal you can defend.",
    domain: "Business Negotiation",
    targetAudience: "Business, operations and procurement students",
    prerequisites: ["No technical background required"],
    objectives: [
      "Separate a supplier's position from its underlying interests",
      "Trade across price, term and reliability instead of arguing one number",
      "Recognise when your leverage supports walking away",
    ],
    language: "English",
    level: "Intermediate",
    estimatedMinutes: 20,
    emoji: "🤝",
    audience: ["general", "non_cs", "cs_student", "career_switcher"],
    lessons: [
      {
        id: "biz-supplier-negotiation",
        title: "Renew the supplier contract",
        summary:
          "A stateful negotiation: every move changes price, reliability, relationship or your alternatives.",
        minutes: 20,
        objectives: [
          "Choose a first move that protects the relationship",
          "Use contract term or an alternative quote as leverage",
          "Close a deal you can defend to operations",
        ],
        blocks: [
          reading(
            "biz-supplier-reading",
            `## Positions and interests, with numbers attached

Your supplier asks for a **12% price increase** before the annual renewal. Your budget only covers **5%**. Reliability has slipped from 9 to 7 out of 10, and late deliveries are disrupting the bakery's morning production.

A second supplier has quoted **3% more than today's price**, but switching costs two weeks of onboarding and a new delivery schedule. That quote is useful leverage only if you are genuinely prepared to use it.

Before the meeting, decide which of these you can trade: price, contract length, delivery guarantees, or the relationship itself. A good deal does not win every variable; it protects the ones that matter most to operations.`,
          ),
          simulation("supplier-renewal", {
            schemaVersion: 1,
            title: "Negotiate the supplier renewal",
            scenario: {
              description:
                "You run operations for a bakery chain. The current supplier wants a 12% increase at renewal. Your budget supports 5%, late deliveries are hurting morning production, and a competing quote exists but switching has a cost.",
              objectives: [
                "Keep the annual increase within a defensible range",
                "Improve delivery reliability for morning production",
                "Preserve a working relationship with the supplier",
              ],
              initialSituation:
                "The renewal meeting starts in ten minutes. The supplier's opening position is 12%. You have today's delivery data and an alternative quote on paper, but no agreed deal.",
              participantRole:
                "You are the operations lead for the bakery chain, responsible for cost and for keeping morning production running.",
              persona:
                "The supplier's account manager: friendly, under pressure from their own costs, and willing to trade term for price.",
            },
            variables: [
              {
                id: "price",
                type: "number",
                label: "Proposed increase",
                initial: 12,
                min: 0,
                max: 20,
                unit: "%",
                visible: true,
                description: "The annual price increase currently on the table.",
              },
              {
                id: "reliability",
                type: "number",
                label: "Delivery reliability",
                initial: 7,
                min: 0,
                max: 10,
                visible: true,
                description: "On-time delivery score; low scores disrupt morning production.",
              },
              {
                id: "relationship",
                type: "number",
                label: "Relationship",
                initial: 6,
                min: 0,
                max: 10,
                visible: true,
                description: "How willing the supplier is to solve problems with you.",
              },
              {
                id: "term",
                type: "enum",
                label: "Contract term",
                initial: "12 months",
                options: ["12 months", "24 months"],
                visible: true,
              },
              {
                id: "alternative",
                type: "boolean",
                label: "Alternative quote ready",
                initial: false,
                visible: true,
                description: "Whether you have prepared a credible switching option.",
              },
            ],
            startStage: "opening",
            stages: [
              {
                id: "opening",
                title: "The opening exchange",
                narrative:
                  "The account manager opens with 12% and mentions rising fuel costs. You have not shown your hand. What do you do first?",
                actions: [
                  {
                    id: "anchor",
                    label: "Anchor on the 5% budget limit",
                    description:
                      "State plainly that the budget supports 5% and wait for their response.",
                    effects: [
                      { op: "set", variable: "price", value: 8 },
                      { op: "add", variable: "relationship", value: -1 },
                    ],
                    feedback:
                      "The anchor moves the number but makes the conversation more positional. You have not learned what the supplier actually needs.",
                    nextStage: "trade",
                  },
                  {
                    id: "ask-drivers",
                    label: "Ask what is driving the increase",
                    description:
                      "Explore their cost pressures and delivery constraints before countering.",
                    effects: [
                      { op: "add", variable: "relationship", value: 2 },
                    ],
                    feedback:
                      "You learn that fuel and a driver shortage are behind the request. Understanding the interest gives you something to trade, not just a number to refuse.",
                    nextStage: "understand",
                  },
                  {
                    id: "accept-and-push",
                    label: "Accept 12% but demand perfect delivery",
                    description:
                      "Trade price for a strict service guarantee.",
                    effects: [
                      { op: "set", variable: "price", value: 12 },
                      { op: "add", variable: "reliability", value: 2 },
                      { op: "add", variable: "relationship", value: -1 },
                    ],
                    feedback:
                      "You buy service with money. Reliability improves, but the budget gap remains and the supplier knows you will pay to avoid conflict.",
                    nextStage: "trade",
                  },
                ],
              },
              {
                id: "understand",
                title: "What the supplier needs",
                narrative:
                  "Their margin is squeezed by fuel and driver costs. They value a longer contract because it lets them plan routes. Your alternative quote is still in your bag.",
                actions: [
                  {
                    id: "offer-term",
                    label: "Offer a 24-month term for a lower increase",
                    description:
                      "Give them planning certainty in exchange for a smaller increase.",
                    effects: [
                      { op: "set", variable: "term", value: "24 months" },
                      { op: "add", variable: "price", value: -4 },
                      { op: "add", variable: "relationship", value: 1 },
                    ],
                    feedback:
                      "You trade across variables instead of arguing about one. The supplier gets stability; you get a price closer to budget.",
                    nextStage: "trade",
                  },
                  {
                    id: "mention-alternative",
                    label: "Mention the alternative supplier quote",
                    description:
                      "Make your outside option visible without pretending you have already switched.",
                    effects: [
                      { op: "set", variable: "alternative", value: true },
                      { op: "add", variable: "relationship", value: -2 },
                    ],
                    feedback:
                      "Leverage is now real, but the relationship cools. You can walk away, and the supplier knows it.",
                    nextStage: "trade",
                  },
                ],
              },
              {
                id: "trade",
                title: "Close the deal",
                narrative:
                  "The supplier asks for your final position. Operations needs a cost you can defend and a delivery promise you can plan around.",
                actions: [
                  {
                    id: "agree-eight",
                    label: "Agree 8% with service credits for late deliveries",
                    availableWhen: {
                      kind: "compare",
                      variable: "price",
                      op: "lte",
                      value: 8,
                    },
                    description:
                      "Accept the number on the table and attach a consequence to missed deliveries.",
                    effects: [
                      { op: "add", variable: "reliability", value: 2 },
                      { op: "add", variable: "relationship", value: 1 },
                    ],
                    feedback:
                      "You close within a defensible range and convert the delivery complaint into a concrete commitment.",
                    nextStage: "success-ending",
                  },
                  {
                    id: "agree-twelve",
                    label: "Agree 12% in exchange for guaranteed delivery",
                    availableWhen: {
                      kind: "compare",
                      variable: "price",
                      op: "gt",
                      value: 8,
                    },
                    description:
                      "Pay the full increase but make reliability the supplier's problem.",
                    effects: [
                      { op: "add", variable: "reliability", value: 3 },
                      { op: "add", variable: "relationship", value: -1 },
                    ],
                    feedback:
                      "Delivery improves, but you spent the budget headroom and taught the supplier that price pressure works.",
                    nextStage: "partial-ending",
                  },
                  {
                    id: "walk-away",
                    label: "Walk away and switch suppliers",
                    availableWhen: {
                      kind: "compare",
                      variable: "alternative",
                      op: "eq",
                      value: true,
                    },
                    description:
                      "Use the alternative quote and accept the onboarding cost.",
                    effects: [
                      { op: "add", variable: "relationship", value: -4 },
                    ],
                    feedback:
                      "You exercised your outside option. Switching may be right, but the two-week onboarding now lands on morning production.",
                    nextStage: "failure-ending",
                  },
                ],
              },
              {
                id: "success-ending",
                title: "A deal operations can plan around",
                narrative:
                  "The supplier accepts 8% with service credits. Your finance lead can sign it, and morning production has a delivery commitment it can hold the supplier to.",
                actions: [],
                ending: {
                  outcome: "success",
                  summary:
                    "You traded contract certainty for price, protected the budget, and turned a complaint about lateness into a measurable commitment.",
                },
              },
              {
                id: "partial-ending",
                title: "Reliable, but expensive",
                narrative:
                  "Deliveries improve, but the 12% increase consumes the headroom you needed for the new route. Finance approves it reluctantly.",
                actions: [],
                ending: {
                  outcome: "partial",
                  summary:
                    "You solved the operational symptom at the cost of the budget. A longer term or a credible alternative could have moved the price without losing reliability.",
                },
              },
              {
                id: "failure-ending",
                title: "Leverage without a landing plan",
                narrative:
                  "You walk away. The alternative supplier is competent but needs two weeks to onboard, and the first week of the transition is chaotic.",
                actions: [],
                ending: {
                  outcome: "failure",
                  summary:
                    "The outside option was real, but you used it without securing the transition. Leverage only helps when the alternative is genuinely executable.",
                },
              },
            ],
            completion: {
              maxSteps: 4,
              rules: [],
              exhaustedSummary:
                "The meeting ended without a signed renewal. Operations still needs a price it can defend and a delivery promise it can plan around.",
            },
            rubric: [
              {
                id: "interests",
                criterion: "Explores the supplier's interests before bargaining",
                description: "Uses questions, not only counter-offers.",
              },
              {
                id: "trade",
                criterion: "Trades across more than one variable",
                description: "Connects price to term, reliability or relationship.",
              },
              {
                id: "leverage",
                criterion: "Uses leverage only when it can be executed",
                description: "An alternative quote is a plan, not a threat.",
              },
              {
                id: "outcome",
                criterion: "Closes a deal defensible to operations",
                description: "The final agreement protects cost and morning production.",
              },
            ],
            debrief: {
              success:
                "You found a trade rather than a winner: the supplier gained planning certainty, operations gained price discipline and a service commitment. That is the core of an integrative negotiation.",
              partial:
                "You fixed reliability but paid for it with the budget you needed elsewhere. Next time, ask what the supplier values besides price before making a concession.",
              failure:
                "Walking away can be correct, but only after checking that the alternative is executable. Onboarding cost and transition risk belong in the decision, not outside it.",
              incomplete:
                "The meeting ran out of time without a decision. A prepared range, a trade list and a clear walk-away point make a renewal meeting closeable.",
            },
          }),
        ],
      },
    ],
  },
];
