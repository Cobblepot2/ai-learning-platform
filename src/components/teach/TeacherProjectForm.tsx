"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LEVEL_LABELS, LEVELS, type Level } from "@/lib/projects/generated/profile";

const input =
  "mt-2 w-full rounded-2xl border border-white/20 bg-black/30 px-5 py-3 text-white outline-none placeholder:text-white/35 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20";

const MODES = [
  ["create", "From your material", "Paste your notes or slides' text. The AI builds a job around two of their ideas."],
  ["customise", "Customise a project", "Start from an existing project and say what to change for your class."],
] as const;

/** Creates an instructor's project with the AI: from teaching material, or from an existing project. */
export function TeacherProjectForm({ bases, initialBase }: { bases: { id: string; title: string }[]; initialBase?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"create" | "customise">(initialBase ? "customise" : "create");
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [learners, setLearners] = useState("");
  const [level, setLevel] = useState<Level | null>(null);
  const [teaching, setTeaching] = useState("");
  const [instructions, setInstructions] = useState("");
  const [base, setBase] = useState(initialBase ?? bases[0]?.id ?? "");
  const [working, setWorking] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!working) return;
    const started = Date.now();
    const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [working]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setWorking(true);
    setSeconds(0);
    setError("");
    const body =
      mode === "create" ? { mode, subject, topic, learners, level: level ?? undefined, teaching, instructions } : { mode, base, instructions };
    try {
      const res = await fetch("/api/teach/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Something went wrong. Please try again.");
      router.push(`/teach/projects/${data.id}`);
    } catch (cause) {
      setError((cause as Error).message);
      setWorking(false);
    }
  }

  const chip = (on: boolean) => `rounded-full border px-3 py-1 text-sm ${on ? "border-cyan-300 bg-cyan-300/10 text-white" : "border-white/15 text-white/70 hover:border-white/40"}`;

  return (
    <form onSubmit={submit}>
      <fieldset disabled={working} className="space-y-6">
        <div role="radiogroup" aria-label="How to create it" className="grid gap-2 sm:grid-cols-2">
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

        {mode === "create" ? (
          <>
            <div>
              <label htmlFor="tp-subject" className="font-semibold">Subject</label>
              <input id="tp-subject" value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={80} required minLength={2} placeholder="Software engineering" className={input} />
            </div>
            <div>
              <label htmlFor="tp-teaching" className="font-semibold">
                Your teaching material <span className="font-normal text-white/45">(optional)</span>
              </label>
              <p className="mt-1 text-sm text-white/50">The concepts, their explanations and the mistakes the AI teammate makes come from this.</p>
              <textarea id="tp-teaching" value={teaching} onChange={(event) => setTeaching(event.target.value)} maxLength={4000} rows={7} placeholder="Paste a page of your notes…" className={`${input} resize-y`} />
              <p className="mt-1 text-right text-xs text-white/40">{teaching.length} / 4000</p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label htmlFor="tp-learners" className="font-semibold">
                  Your students <span className="font-normal text-white/45">(optional)</span>
                </label>
                <input id="tp-learners" value={learners} onChange={(event) => setLearners(event.target.value)} maxLength={160} placeholder="first-year business students" className={input} />
              </div>
              <div>
                <label htmlFor="tp-topic" className="font-semibold">
                  The job <span className="font-normal text-white/45">(optional)</span>
                </label>
                <input id="tp-topic" value={topic} onChange={(event) => setTopic(event.target.value)} maxLength={200} placeholder="a library's room booking system" className={input} />
              </div>
            </div>
            <div role="radiogroup" aria-label="Students' level">
              <p className="font-semibold">How much do they know already?</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {LEVELS.map((item) => (
                  <button key={item} type="button" role="radio" aria-checked={level === item} onClick={() => setLevel(level === item ? null : item)} className={chip(level === item)}>
                    {LEVEL_LABELS[item]}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div>
            <label htmlFor="tp-base" className="font-semibold">Start from</label>
            <select id="tp-base" value={base} onChange={(event) => setBase(event.target.value)} className={input}>
              {bases.map((item) => (
                <option key={item.id} value={item.id} className="bg-zinc-900">
                  {item.title}
                </option>
              ))}
            </select>
            <p className="mt-2 text-sm text-white/50">The original stays as it is; you get a new copy. A customised copy has the product lead role only.</p>
          </div>
        )}

        <div>
          <label htmlFor="tp-instructions" className="font-semibold">
            {mode === "create" ? "Anything else for your class" : "What to change"} {mode === "create" && <span className="font-normal text-white/45">(optional)</span>}
          </label>
          <textarea
            id="tp-instructions"
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            maxLength={1000}
            minLength={mode === "customise" ? 10 : undefined}
            required={mode === "customise"}
            rows={3}
            placeholder={mode === "create" ? "Keep the language simple; most are second-language English speakers." : "Set it in a secondary school's canteen, and make the client a head teacher."}
            className={`${input} resize-y`}
          />
        </div>
      </fieldset>

      {error && <p className="mt-5 rounded-2xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-100">{error}</p>}
      <div className="mt-7 flex flex-wrap items-center gap-4">
        <button type="submit" disabled={working} className="inline-flex rounded-full bg-white px-7 py-3 text-[15px] font-medium text-black hover:bg-white/85 disabled:opacity-60">
          {working ? "Creating…" : mode === "create" ? "Create the project" : "Create the customised copy"}
        </button>
        <p className="text-sm text-white/55" aria-live="polite">
          {working ? <>The AI writes it, then every way through it is checked. <span className="tabular-nums">{seconds}s</span></> : "Takes one to three minutes."}
        </p>
      </div>
    </form>
  );
}
