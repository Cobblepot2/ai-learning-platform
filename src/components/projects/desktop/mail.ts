import type { ProjectView } from "@/lib/projects/runtime";

export type Mail = {
  id: string;
  from: string;
  initials: string;
  tone: string;
  subject: string;
  body: string;
  /** In-game time shown in the list. */
  time: string;
  kind: "email" | "ticket";
};

const GRACE = { from: "Grace Wong", initials: "GW", tone: "from-rose-400 to-orange-400" };
const LEO = { from: "Leo", initials: "L", tone: "from-sky-400 to-indigo-500" };
const KIT = { from: "Kit (reception)", initials: "K", tone: "from-emerald-400 to-teal-500" };
const CODY = { from: "Cody", initials: "C", tone: "from-violet-500 to-fuchsia-500" };
const QA = { from: "Harbour Clinic · weekly report", initials: "HC", tone: "from-stone-500 to-stone-700" };

function who(from: string) {
  if (from.startsWith("Grace")) return GRACE;
  if (from.startsWith("Leo")) return LEO;
  if (from.startsWith("Kit")) return KIT;
  return { from, initials: from.slice(0, 2).toUpperCase(), tone: "from-stone-400 to-stone-600" };
}

/**
 * The inbox is the scenario's opening mail plus messages that follow from what
 * the learner did. Everything here comes from the public view, so nothing
 * hidden (variants, checklists) can leak through Mail.
 */
export function mailbox(view: ProjectView): Mail[] {
  const mails: Mail[] = view.inbox.map((message, index) => ({
    id: message.id,
    ...who(message.from),
    from: message.from,
    subject: message.subject,
    body: message.body,
    time: `Mon 08:${String(10 + index * 7).padStart(2, "0")}`,
    kind: message.kind,
  }));
  const chose = (id: string) => view.history.some((event) => event.choice === id);

  if (chose("call-grace")) {
    mails.push({ id: "grace-call", ...GRACE, subject: "Re: Can you build us an app?", body: "Of course! I have a few minutes between patients right now. I'll ring you on Meet.\n\nGrace", time: "Mon 09:02", kind: "email" });
  }
  if (chose("cody-starts")) {
    mails.push({ id: "cody-started", ...CODY, subject: "Started: patient booking app", body: "I scaffolded a patient booking app with sign-up, login and online booking. I assumed patients will book themselves. Two days of work so far.\n\nCody", time: "Tue 17:40", kind: "email" });
    mails.push({ id: "grace-call", ...GRACE, subject: "Before you go further…", body: "Leo says you've started building something. Before you go further, can we talk? I'll ring you on Meet.\n\nGrace", time: "Wed 09:05", kind: "email" });
  }
  if (chose("send-quote")) {
    mails.push({ id: "grace-call", ...GRACE, subject: "Re: Quote", body: "Thanks for the quote, but I'm honestly not sure what I'd be paying for. Can we talk first? I'll ring you on Meet.\n\nGrace", time: "Mon 11:20", kind: "email" });
  }
  if (view.work) {
    mails.push({ id: "cody-pr", ...CODY, subject: view.track === "engineering" ? `Pull request: ${view.work.prTitle}` : `Ready for review: ${view.work.prTitle}`, body: `${view.work.prSummary}\n\nOpen Review to see it.\n\nCody`, time: `Day ${Math.max(1, view.meters.effort)}`, kind: "email" });
  }
  if (view.completion) {
    mails.push({ id: "outcome", ...QA, subject: view.completion.outcome === "success" ? "Two weeks on the booking board" : "About the booking board", body: view.completion.summary, time: "Two weeks later", kind: "email" });
  }
  return mails.reverse();
}
