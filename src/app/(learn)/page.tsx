import Link from "next/link";
import { Reveal } from "@/components/home/Reveal";
import { SpotlightCard } from "@/components/home/SpotlightCard";
import { glass } from "@/components/home/glass";
import { AppIcon, Avatar } from "@/components/projects/desktop/icons";
import { APPS, DOCK, type AppId } from "@/components/projects/desktop/config";

// Platform copy only. Anything about a particular scenario belongs in its listing.
const DESK: Record<AppId, string> = {
  mail: "Read the brief: the client's request, a ticket from the people who'll use the system and a note from your manager.",
  call: "Interview the client. They know what's really wrong, but they only answer what you ask.",
  notes: "Write the requirements, including how everyone will know the work succeeded.",
  cody: "Brief the AI coding agent. It builds exactly what you describe, gaps and all.",
  review: "Check what comes back. Approve it, or send it back with a clear reason.",
  launch: "Choose how to release it, then see how it plays out.",
};

// The client and Cody respond to what the learner writes, so they are played by
// AI. The manager and the users react to decisions, which the script handles.
const TEAM = [
  { name: "The client", note: "Answers your questions on a live call. Knows the business but not the technology, and only tells you what you ask.", ai: true },
  { name: "Cody", note: "An AI coding agent that works from your brief exactly as written: fast, confident and literal.", ai: true },
  { name: "Your manager", note: "Sets the budget and the deadline, and gets in touch when either starts to slip.", ai: false },
  { name: "The users", note: "Live with whatever you ship, and are the first to notice what you missed.", ai: false },
] as const;

const TEAM_AVATAR: Record<string, { initials: string; tone: string }> = {
  "The client": { initials: "C", tone: "from-rose-400 to-orange-400" },
  "Your manager": { initials: "M", tone: "from-sky-400 to-indigo-500" },
  "The users": { initials: "U", tone: "from-emerald-400 to-teal-500" },
};

const FLUENCY = [
  { title: "Delegation", text: "What you handed to AI, and what you kept for yourself.", rating: "strong" },
  { title: "Description", text: "How clearly you described what you needed.", rating: "mixed" },
  { title: "Discernment", text: "Whether you spotted what it got wrong.", rating: "strong" },
  { title: "Diligence", text: "Whether you took responsibility for what shipped.", rating: "weak" },
] as const;

const RATING = {
  strong: "bg-emerald-400/15 text-emerald-300 ring-emerald-400/30",
  mixed: "bg-amber-400/15 text-amber-300 ring-amber-400/30",
  weak: "bg-rose-400/15 text-rose-300 ring-rose-400/30",
};

const ENDINGS = [
  { label: "Success", tone: "text-emerald-300", text: "The client's problem is solved, and you can prove it." },
  { label: "Partly there", tone: "text-amber-300", text: "It mostly works, but something slipped through and cost time." },
  { label: "It went wrong", tone: "text-rose-300", text: "A gap in your brief reached real users." },
];

const PRINCIPLES = [
  { title: "Scripted, so it's fair", text: "Every project follows a written story with real branches. It never drifts, and every learner faces the same situation." },
  { title: "AI where your words matter", text: "AI reads your questions, requirements and brief: the moments where how you put something changes what happens." },
  { title: "Consequences, not quizzes", text: "There are no right-answer buttons. What you miss or wave through shows up later, in the code, the release and the report." },
];

const pill = "inline-flex items-center justify-center rounded-full px-7 py-3 text-[15px] font-medium transition duration-300";
const primary = `${pill} bg-white text-black hover:bg-white/85`;
const secondary = `${pill} border border-white/20 bg-transparent text-white/80 hover:scale-[1.02] hover:border-white/50 hover:bg-white/15 hover:text-white hover:shadow-[0_0_20px_rgba(255,255,255,0.3),0_0_40px_rgba(255,255,255,0.1)]`;

// Every section shares the navbar's width, so their edges line up on wide screens.
const column = "mx-auto w-full max-w-4xl px-4 lg:px-0";

export default function Home() {
  return (
    <div className="relative text-white">
      {/* Hero */}
      <section className={`${column} flex min-h-[calc(100dvh-4rem)] flex-col items-center justify-center py-16 text-center lg:min-h-[calc(100dvh-7rem)]`}>
        <Reveal delay={100}>
          <h1 className="text-balance text-5xl font-bold leading-[1.05] tracking-tight drop-shadow-lg sm:text-7xl">
            Lead a software project{" "}
            <span className="bg-gradient-to-r from-cyan-300 via-indigo-300 to-fuchsia-300 bg-clip-text text-transparent">with AI on your team.</span>
          </h1>
        </Reveal>
        <Reveal delay={200}>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-white/75 sm:text-xl">
            Step into a simulated workday. Interview a client, brief an AI coding agent, review what it builds and decide when to ship. Every choice changes how the project ends.
          </p>
        </Reveal>
        <Reveal delay={300}>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link href="/projects" className={primary}>
              Browse projects
            </Link>
            <Link href="#how" className={secondary}>
              How it works
            </Link>
          </div>
        </Reveal>
      </section>

      {/* How a project works */}
      <section id="how" className={`${column} scroll-mt-32 py-20`}>
        <Reveal>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300/80">How it works</p>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight sm:text-5xl">One desktop, six tools.</h2>
          <p className="mt-4 max-w-2xl text-lg text-white/65">Each project brings a new client and a new problem. The tools, and the habits they build, stay the same.</p>
        </Reveal>
        <ol className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {DOCK.map((app, index) => (
            <li key={app}>
              <SpotlightCard delay={(index % 3) * 100} className="h-full p-7">
                <div className="flex items-center justify-between">
                  <AppIcon app={app} size={52} />
                  <span className="font-mono text-sm text-white/35">0{index + 1}</span>
                </div>
                <h3 className="mt-5 text-xl font-semibold">{APPS[app].name}</h3>
                <p className="mt-2 leading-relaxed text-white/65">{DESK[app]}</p>
              </SpotlightCard>
            </li>
          ))}
        </ol>
      </section>

      {/* Who you work with */}
      <section className={`${column} py-20`}>
        <Reveal>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-fuchsia-300/80">Who you work with</p>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight sm:text-5xl">AI plays the people you talk to.</h2>
          <p className="mt-4 max-w-2xl text-lg text-white/65">
            The client and Cody respond to what you actually write. Your manager and the users react to the decisions you make, following the project&apos;s script.
          </p>
        </Reveal>
        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {TEAM.map((person, index) => (
            <SpotlightCard key={person.name} delay={(index % 2) * 100} className="h-full p-6">
              <div className="flex items-center justify-between gap-3">
                {person.name === "Cody" ? (
                  <AppIcon app="cody" size={48} />
                ) : (
                  <Avatar initials={TEAM_AVATAR[person.name].initials} tone={TEAM_AVATAR[person.name].tone} size={48} />
                )}
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${
                    person.ai ? "bg-blue-400/15 text-blue-200 ring-blue-400/30" : "bg-white/5 text-white/55 ring-white/15"
                  }`}
                >
                  {person.ai ? "Played by AI" : "Scripted"}
                </span>
              </div>
              <h3 className="mt-4 text-lg font-semibold">{person.name}</h3>
              <p className="mt-2 leading-relaxed text-white/70">{person.note}</p>
            </SpotlightCard>
          ))}
        </div>
      </section>

      {/* How it's built */}
      <section className={`${column} py-20`}>
        <Reveal>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-300/80">Why it works</p>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight sm:text-5xl">Scripted, with AI where it counts.</h2>
        </Reveal>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {PRINCIPLES.map((item, index) => (
            <SpotlightCard key={item.title} delay={index * 100} className="h-full p-7">
              <h3 className="text-xl font-semibold">{item.title}</h3>
              <p className="mt-3 leading-relaxed text-white/65">{item.text}</p>
            </SpotlightCard>
          ))}
        </div>
      </section>

      {/* Endings and the report */}
      <section className={`${column} py-20`}>
        <Reveal>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300/80">Every choice counts</p>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight sm:text-5xl">See how you worked with AI.</h2>
          <p className="mt-4 max-w-2xl text-lg text-white/65">
            Skip a question and Cody builds the wrong thing. Approve too quickly and the problem ships. At the end you get a report based on what you actually did, scored on the four AI Fluency competencies.
          </p>
        </Reveal>
        <ul className="mt-10 grid gap-5 md:grid-cols-3">
          {ENDINGS.map((ending, index) => (
            <li key={ending.label}>
              <SpotlightCard delay={index * 100} className="h-full p-5">
                <p className={`text-sm font-semibold ${ending.tone}`}>{ending.label}</p>
                <p className="mt-2 text-white/70">{ending.text}</p>
              </SpotlightCard>
            </li>
          ))}
        </ul>
        <Reveal delay={150} className={`mt-5 ${glass} p-6 shadow-2xl sm:p-8`}>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Project report</p>
          <p className="mt-1 text-xl font-semibold">How you worked with AI</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {FLUENCY.map((item) => (
              <div key={item.title} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{item.title}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${RATING[item.rating]}`}>{item.rating}</span>
                </div>
                <p className="mt-2 text-sm text-white/60">{item.text}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* Closing call to action */}
      <section className={`${column} pb-24 pt-10 text-center`}>
        <Reveal>
          <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-5xl">Ready for your first client?</h2>
          <p className="mt-4 text-lg text-white/65">Your progress is saved as you go, so you can stop and pick up later.</p>
          <Link href="/projects" className={`${primary} mt-8`}>
            Browse projects
          </Link>
        </Reveal>
      </section>

      <footer className="border-t border-white/10 bg-black/40 px-4 py-6 text-center text-sm text-white/40 backdrop-blur">
        DevPath · COMP5241 group project
      </footer>
    </div>
  );
}
