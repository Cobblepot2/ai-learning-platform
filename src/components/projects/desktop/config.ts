import type { ProjectView } from "@/lib/projects/runtime";

export type AppId = "mail" | "call" | "notes" | "cody" | "review" | "launch";

export type Op =
  | { op: "start" }
  | { op: "restart" }
  | { op: "choose"; actionId: string }
  | { op: "ask"; question: string }
  | { op: "end-interview" }
  | { op: "requirements"; text: string }
  | { op: "brief"; text: string }
  | { op: "request-changes"; reasonId?: string; path?: string; line?: number };

export type Send = (op: Op) => Promise<boolean>;

export const APPS: Record<AppId, { name: string; title: string }> = {
  mail: { name: "Mail", title: "Mail — Inbox" },
  call: { name: "Meet", title: "Meet — Grace Wong" },
  notes: { name: "Notes", title: "Notes — Requirements" },
  cody: { name: "Cody", title: "Cody — AI coding agent" },
  review: { name: "Review", title: "Review — harbour-clinic/booking-board" },
  launch: { name: "Launch", title: "Launch — Release plan" },
};

export const DOCK: AppId[] = ["mail", "call", "notes", "cody", "review", "launch"];

/** The app that owns each stage. Opening a stage brings its app to the front. */
export const STAGE_APP: Record<string, AppId | null> = {
  "choose-track": null,
  inbox: "mail",
  interview: "call",
  requirements: "notes",
  brief: "cody",
  "brief-test": "cody",
  review: "review",
  release: "launch",
};

export const STEPS: { id: string; label: string; app: AppId }[] = [
  { id: "inbox", label: "Read the inbox and decide your first move", app: "mail" },
  { id: "interview", label: "Call Grace and find out what's wrong", app: "call" },
  { id: "requirements", label: "Write the requirements", app: "notes" },
  { id: "brief", label: "Brief Cody", app: "cody" },
  { id: "review", label: "Review Cody's work", app: "review" },
  { id: "release", label: "Decide how to release", app: "launch" },
];

export function stepIndex(view: ProjectView): number {
  if (view.status === "completed") return STEPS.length;
  const id = view.stage.id === "brief-test" ? "brief" : view.stage.id;
  return Math.max(0, STEPS.findIndex((step) => step.id === id));
}

/** What the guide widget says for the current stage. */
export function guideFor(view: ProjectView): string[] {
  const product = view.track === "product";
  if (view.status === "completed") return ["The job is finished. Open Launch to read the project report, or play again as the other role."];
  switch (view.stage.id) {
    case "inbox":
      return [
        "Open Mail and read all three messages.",
        "Grace asks for an app. Kit's ticket and Leo's note tell you more.",
        "Choose your first move at the bottom of Grace's email. There's no undo.",
      ];
    case "interview":
      return [
        "Grace is on the call in Meet. Ask open questions about how bookings go wrong today.",
        "Facts you uncover land in the Notes column on the right of the call.",
        `Ask at least ${view.interview.min} questions. End the call when you know enough; she has time for ${view.interview.max}.`,
      ];
    case "requirements":
      return [
        "Write the requirements note in Notes, in your own words.",
        "Say what the booking board must do, what it must never do, and how you'll know it worked.",
        "Only what you found out on the call is in your notes. Gaps here become gaps later.",
      ];
    case "brief":
    case "brief-test":
      return [
        "Open Cody and write its task.",
        "Cody does exactly what you ask and fills every gap with its own assumptions.",
        product
          ? "Say what to build, what must never happen, and what's out of scope."
          : "Name the constraints, what's out of scope, and how you'll check the result (a test).",
      ];
    case "review":
      return product
        ? [
            "Watch Cody's walkthrough in Review as if you were Grace.",
            "If something would hurt the clinic, send it back with the reason. A wrong reason costs a day.",
            "Approve when you're satisfied.",
          ]
        : [
            "Read Cody's pull request in Review: the diff and the checks.",
            "If a line is wrong, click it and request changes. A wrong line costs a day.",
            "Approve and merge when you're satisfied.",
          ];
    case "release":
      return [
        "Open Launch and choose how the clinic gets the booking board.",
        "Think about how you'll know it worked, and what happens if you missed something.",
      ];
    default:
      return [];
  }
}

export const CAST = [
  { name: "Grace Wong", role: "Practice manager, Harbour Family Clinic", note: "Your client. Busy, not technical, knows how the front desk really works.", initials: "GW", tone: "from-rose-400 to-orange-400" },
  { name: "Leo", role: "Your manager at the studio", note: "Gave this job two weeks. Watches the budget.", initials: "L", tone: "from-sky-400 to-indigo-500" },
  { name: "Cody", role: "AI coding agent", note: "Builds exactly what you ask for, fast. Never asks a clarifying question.", initials: "C", tone: "from-violet-500 to-fuchsia-500" },
  { name: "Mandy & Kit", role: "Receptionists", note: "Share one PC and one spreadsheet. They'll use whatever you ship.", initials: "MK", tone: "from-emerald-400 to-teal-500" },
] as const;
