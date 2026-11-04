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
  | { op: "request-changes"; reasonId?: string; path?: string; line?: number; explanation?: string };

export type Send = (op: Op) => Promise<boolean>;

const APP_NAMES: Record<AppId, string> = {
  mail: "Mail",
  call: "Meet",
  notes: "Notes",
  cody: "Cody",
  review: "Review",
  launch: "Launch",
};

export const DOCK: AppId[] = ["mail", "call", "notes", "cody", "review", "launch"];


/** First name, for friendly wording: "Grace Wong" → "Grace". */
export function firstName(name: string) {
  return name.trim().split(/\s+/)[0];
}

function slug(text: string) {
  return text
    .toLowerCase()
    .replace(/^(the|a|an) /, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** The name an app goes by in this project: the assistant's app is named after it. */
export function appName(app: AppId, view: ProjectView | null): string {
  return app === "cody" && view ? view.scenario.assistant.name : APP_NAMES[app];
}

/** Window titles, macOS style: "App — what it shows". */
export function appTitle(app: AppId, view: ProjectView): string {
  const { client, assistant } = view.scenario;
  switch (app) {
    case "mail":
      return "Mail — Inbox";
    case "call":
      return `Meet — ${client.name}`;
    case "notes":
      return "Notes — Requirements";
    case "cody":
      return `${assistant.name} — ${assistant.kind}`;
    case "review":
      return `Review — ${reviewRepo(view)}`;
    case "launch":
      return "Launch — Release plan";
  }
}

/** Where the work lives, shown in Review: "harbour-clinic/booking-board". */
export function reviewRepo(view: ProjectView): string {
  const owner = view.scenario.id.startsWith("gen-") ? slug(view.scenario.client.organisation) : view.scenario.id;
  return `${owner}/${slug(view.scenario.words.deliverable) || "work"}`;
}

/** The app each stage needs. The learner opens it; its Dock icon asks for attention until then. */
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

const STEP_IDS = ["inbox", "interview", "requirements", "brief", "review", "release"] as const;

export function stepsFor(view: ProjectView): { id: string; label: string; app: AppId }[] {
  const client = firstName(view.scenario.client.name);
  const agent = view.scenario.assistant.name;
  const labels: Record<(typeof STEP_IDS)[number], string> = {
    inbox: "Read the inbox and decide your first move",
    interview: `Call ${client} and find out what's wrong`,
    requirements: "Write the requirements",
    brief: `Brief ${agent}`,
    review: `Review ${agent}'s work`,
    release: "Decide how to release",
  };
  return STEP_IDS.map((id) => ({ id, label: labels[id], app: STAGE_APP[id]! }));
}

export function stepIndex(view: ProjectView): number {
  if (view.status === "completed") return STEP_IDS.length;
  const id = view.stage.id === "brief-test" ? "brief" : view.stage.id;
  return Math.max(0, STEP_IDS.findIndex((step) => step === id));
}

/** One line telling the learner which app to open and what to do there. */
export function nextStep(view: ProjectView): string | null {
  const client = firstName(view.scenario.client.name);
  const agent = view.scenario.assistant.name;
  if (view.status === "completed") return "Read the project report in Launch";
  switch (view.stage.id) {
    case "inbox":
      return `Open Mail and reply to ${client}'s email`;
    case "interview":
      return `Open Meet and take ${client}'s call`;
    case "requirements":
      return "Open Notes and write the requirements";
    case "brief":
    case "brief-test":
      return `Open ${agent} and write its task`;
    case "review":
      return view.track === "engineering" ? `Open Review and check ${agent}'s pull request` : `Open Review and watch ${agent}'s walkthrough`;
    case "release":
      return "Open Launch and decide how to release";
    default:
      return null;
  }
}

/** What the guide widget says for the current stage. */
export function guideFor(view: ProjectView): string[] {
  const product = view.track === "product";
  const client = firstName(view.scenario.client.name);
  const agent = view.scenario.assistant.name;
  const { deliverable, manager } = view.scenario.words;
  const second = view.inbox[1];
  if (view.status === "completed") return ["The job is finished. Open Launch to read the project report, or play again."];
  switch (view.stage.id) {
    case "inbox":
      return [
        `Open Mail and read all ${view.inbox.length} messages.`,
        second
          ? `${client}'s email asks for a solution. ${firstName(second.from)}'s ${second.kind === "ticket" ? "ticket" : "message"} and ${manager}'s note tell you more.`
          : `${client}'s email asks for a solution.`,
        `Choose your first move at the bottom of ${client}'s email. There's no undo.`,
      ];
    case "interview":
      return [
        `${client} is on the call in Meet. Ask open questions about what goes wrong today.`,
        "Facts you uncover land in the column on the right of the call.",
        `Ask at least ${view.interview.min} questions. End the call when you know enough; ${client} has time for ${view.interview.max}.`,
      ];
    case "requirements":
      return [
        "Write the requirements note in Notes, in your own words.",
        `Say what ${deliverable} must do, what it must never do, and how you'll know it worked.`,
        "Only what you found out on the call is in your notes. Gaps here become gaps later.",
      ];
    case "brief":
    case "brief-test":
      return [
        `Open ${agent} and write its task.`,
        `${agent} does exactly what you ask and fills every gap with its own assumptions.`,
        product
          ? "Say what to make, what must never happen, and what's out of scope."
          : "Name the constraints, what's out of scope, and how you'll check the result (a test).",
      ];
    case "review":
      return product
        ? [
            `Watch ${agent}'s walkthrough in Review as if you were ${client}.`,
            ...(view.conceptCount ? ["When you send it back, say what goes wrong and why it happens. The report names the ideas behind it at the end."] : []),
            "If something would hurt the client, send it back with the reason. A wrong reason costs a day.",
            "Approve when you're satisfied.",
          ]
        : [
            `Read ${agent}'s pull request in Review: the diff and the checks.`,
            "If a line is wrong, click it and request changes. A wrong line costs a day.",
            "Approve and merge when you're satisfied.",
          ];
    case "release":
      return [
        `Open Launch and choose how ${deliverable} reaches ${client}'s people.`,
        "Think about how you'll know it worked, and what happens if you missed something.",
      ];
    default:
      return [];
  }
}

/** Avatar colours by role, so every project's cast looks the same way. */
export const CAST_TONE: Record<"client" | "manager" | "assistant" | "users", string> = {
  client: "from-rose-400 to-orange-400",
  manager: "from-sky-400 to-indigo-500",
  assistant: "from-violet-500 to-fuchsia-500",
  users: "from-emerald-400 to-teal-500",
};

/** "Grace Wong" → "GW", "Mandy & Kit" → "MK". */
export function initials(name: string) {
  const words = name.replace(/\(.*?\)/g, "").split(/[\s&]+/).filter(Boolean);
  return words.slice(0, 2).map((word) => word[0]!.toUpperCase()).join("") || "?";
}
