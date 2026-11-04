"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { glass } from "@/components/home/glass";
import { useAuth } from "@/lib/auth-store";
import { LEVEL_LABELS, LEVELS, readProfile, type Level } from "@/lib/projects/generated/profile";
import { getSupabase } from "@/lib/supabase/client";

const SUBJECTS = ["Software engineering", "Statistics", "Economics", "Psychology", "Chemistry", "Accounting", "Ethics"];

// What the learner sees while the AI works; a generation takes about a minute.
const STAGES = [
  { after: 0, text: "Writing the client, the problem and what the client knows…" },
  { after: 20, text: "Writing what the AI teammate delivers, and how it can go wrong…" },
  { after: 45, text: "Checking that every path through the project plays fairly…" },
  { after: 75, text: "Fixing what the checks found. This can take another minute…" },
];

const MODES = [
  ["project", "One project", "A single job on the desktop. About a minute to create."],
  ["path", "A learning path", "Three projects that teach a subject step by step, from your level up."],
] as const;

const input =
  "mt-2 w-full rounded-2xl border border-white/20 bg-black/30 px-5 py-3 text-white outline-none placeholder:text-white/35 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20";

export function CreateProject() {
  const { ready, user } = useAuth();
  const router = useRouter();
  // One project, or a learning path of several that teach one subject.
  const [mode, setMode] = useState<"project" | "path">("project");
  const [topic, setTopic] = useState("");
  const [subject, setSubject] = useState("");
  const [background, setBackground] = useState("");
  const [level, setLevel] = useState<Level | null>(null);
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ id: string; title: string } | null>(null);
  const [seconds, setSeconds] = useState(0);

  // The profile from earlier projects fills the form in.
  useEffect(() => {
    const supabase = getSupabase();
    if (!user || !supabase) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("background,experience")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        const profile = readProfile(data);
        setBackground((current) => current || profile.background);
        setLevel((current) => current ?? profile.level);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (status !== "working") return;
    const started = Date.now();
    const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [status]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("working");
    setSeconds(0);
    setError("");
    try {
      const path = mode === "path";
      const profile = { background, level };
      const res = await fetch(path ? "/api/paths" : "/api/projects/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(path ? { subject, profile } : { topic, subject, profile }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Something went wrong. Please try again.");
      if (path) {
        router.push(`/paths/${data.id}`);
        return;
      }
      setCreated({ id: data.id, title: data.title });
      setStatus("done");
    } catch (cause) {
      setError((cause as Error).message);
      setStatus("error");
    }
  }

  if (!ready) return <div className={`${glass} p-7 text-white/60`}>Loading…</div>;

  if (!user) {
    return (
      <div className={`${glass} p-7`}>
        <p className="text-lg text-white/80">Sign in to create a project. It&apos;s saved to your account, and only you can see it.</p>
        <Link href="/login" className="mt-6 inline-flex rounded-full bg-white px-7 py-3 text-[15px] font-medium text-black hover:bg-white/85">
          Sign in
        </Link>
      </div>
    );
  }

  if (status === "done" && created) {
    return (
      <div className={`${glass} p-7`}>
        <p className="text-sm text-emerald-300">Ready to play</p>
        <h2 className="mt-2 text-2xl font-semibold">{created.title}</h2>
        <p className="mt-3 text-white/65">It passed every check: each fact can be found, and every way the work can go wrong leads somewhere fair.</p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href={`/projects/${created.id}`} className="inline-flex rounded-full bg-white px-7 py-3 text-[15px] font-medium text-black hover:bg-white/85">
            Open the desktop
          </Link>
          <button
            type="button"
            onClick={() => {
              setStatus("idle");
              setCreated(null);
            }}
            className="inline-flex rounded-full border border-white/20 px-7 py-3 text-[15px] font-medium text-white/80 hover:border-white/50 hover:bg-white/10"
          >
            Create another
          </button>
        </div>
      </div>
    );
  }

  const working = status === "working";
  const path = mode === "path";
  const stage = path
    ? { text: "Planning three projects, two new ideas in each…" }
    : ([...STAGES].reverse().find((item) => seconds >= item.after) ?? STAGES[0]);
  const chip = (on: boolean) =>
    `rounded-full border px-3 py-1 text-sm ${on ? "border-cyan-300 bg-cyan-300/10 text-white" : "border-white/15 text-white/70 hover:border-white/40"}`;

  return (
    <form onSubmit={submit} className={`${glass} p-7`}>
      <fieldset disabled={working} className="space-y-6">
        <div role="radiogroup" aria-label="What to create" className="grid gap-2 sm:grid-cols-2">
          {MODES.map(([value, title, note]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={mode === value}
              onClick={() => setMode(value)}
              className={`rounded-2xl border p-4 text-left ${mode === value ? "border-cyan-300 bg-cyan-300/10" : "border-white/15 hover:border-white/40"}`}
            >
              <span className="block font-semibold">{title}</span>
              <span className="mt-1 block text-sm text-white/55">{note}</span>
            </button>
          ))}
        </div>
        <div>
          <label htmlFor="project-background" className="font-semibold">About you</label>
          <p className="mt-1 text-sm text-white/50">Your role or field. The job is set in your world, and the report explains its ideas with examples from it. Saved for next time.</p>
          <input id="project-background" value={background} onChange={(event) => setBackground(event.target.value)} maxLength={160} placeholder="a second-year nursing student" className={input} />
        </div>
        <div>
          <label htmlFor="project-subject" className="font-semibold">
            Subject to learn {!path && <span className="font-normal text-white/45">(optional)</span>}
          </label>
          <p className="mt-1 text-sm text-white/50">
            {path ? "Each project teaches two of its ideas." : "The job then teaches two of its ideas."} Your AI teammate gets them wrong, and you catch it.
          </p>
          <input id="project-subject" value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={80} required={path} minLength={2} placeholder="Statistics" className={input} />
          <div className="mt-3 flex flex-wrap gap-2">
            {SUBJECTS.map((item) => (
              <button key={item} type="button" onClick={() => setSubject(subject === item ? "" : item)} className={chip(subject === item)}>
                {item}
              </button>
            ))}
          </div>
          {subject.trim() && (
            <div className="mt-4" role="radiogroup" aria-label="Your level in the subject">
              <p className="text-sm text-white/70">How much {subject.trim()} do you know?</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {LEVELS.map((item) => (
                  <button key={item} type="button" role="radio" aria-checked={level === item} onClick={() => setLevel(item)} className={chip(level === item)}>
                    {LEVEL_LABELS[item]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        {!path && (
          <div>
            <label htmlFor="project-topic" className="font-semibold">
              What is the job? {subject.trim() && <span className="font-normal text-white/45">(optional)</span>}
            </label>
            <p className="mt-1 text-sm text-white/50">
              {subject.trim()
                ? `Leave it blank and the AI picks a job in your world where ${subject.trim().toLowerCase()} matters.`
                : "One line about the client and what they want. The AI works out what goes wrong."}
            </p>
            <input id="project-topic" value={topic} onChange={(event) => setTopic(event.target.value)} maxLength={200} required={!subject.trim()} minLength={4} placeholder="a loyalty programme for a neighbourhood café" className={input} />
          </div>
        )}
      </fieldset>

      {error && <p className="mt-5 rounded-2xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-100">{error}</p>}

      <div className="mt-7 flex flex-wrap items-center gap-4">
        <button type="submit" disabled={working} className="inline-flex rounded-full bg-white px-7 py-3 text-[15px] font-medium text-black hover:bg-white/85 disabled:opacity-60">
          {working ? "Creating…" : path ? "Plan the path" : "Create the project"}
        </button>
        {working ? (
          <p className="text-sm text-white/70" aria-live="polite">
            {stage.text} <span className="tabular-nums text-white/45">{seconds}s</span>
          </p>
        ) : (
          <p className="text-sm text-white/45">{path ? "Planning takes a few seconds. Each project is created when you reach it." : "Takes about a minute."}</p>
        )}
      </div>
    </form>
  );
}
