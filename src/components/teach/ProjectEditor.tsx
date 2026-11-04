"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ProjectEdits } from "@/lib/projects/generated/edit";

const field =
  "mt-1.5 w-full rounded-xl border border-white/20 bg-black/30 px-4 py-2.5 text-white outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20";

const FACTS: [keyof ProjectEdits["replies"], string][] = [
  ["problem", "What really goes wrong"],
  ["rule", "The rule that must not be broken"],
  ["scope", "Who it's for, and the budget"],
  ["detail", "A useful detail"],
  ["environment", "Where it has to work"],
  ["success", "How the client judges success"],
];

const CONCEPT_FIELDS: [keyof NonNullable<ProjectEdits["concepts"]>["problem"], string, number][] = [
  ["name", "Name", 1],
  ["explanation", "Explanation", 4],
  ["bridge", "Analogy", 2],
  ["misconception", "The misconception the AI teammate acts on", 2],
  ["inTheJob", "Where it shows up in this job (a hint, not the answer)", 2],
];

function Text({ label, value, rows = 2, onChange }: { label: string; value: string; rows?: number; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-sm text-white/70">{label}</span>
      {rows === 1 ? (
        <input value={value} onChange={(event) => onChange(event.target.value)} className={field} />
      ) : (
        <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={rows} className={`${field} resize-y`} />
      )}
    </label>
  );
}

/** Edits the words of an instructor's project. Saving runs the same checks as the AI's drafts. */
export function ProjectEditor({ projectId, initial }: { projectId: string; initial: ProjectEdits }) {
  const router = useRouter();
  const [edits, setEdits] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string; problems?: string[] } | null>(null);
  const set = (change: (draft: ProjectEdits) => void) =>
    setEdits((current) => {
      const next = structuredClone(current);
      change(next);
      return next;
    });

  async function save() {
    setBusy(true);
    setResult(null);
    const res = await fetch(`/api/teach/projects/${projectId}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(edits) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setResult({ ok: false, text: data.error ?? "Could not save. Please try again.", problems: data.problems });
      return;
    }
    setResult({ ok: true, text: "Saved. Students see the changes the next time they open the project." });
    router.refresh();
  }

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Overview</h2>
        <Text label="Title" rows={1} value={edits.title} onChange={(value) => set((draft) => void (draft.title = value))} />
        <Text label="Tagline" rows={1} value={edits.tagline} onChange={(value) => set((draft) => void (draft.tagline = value))} />
        <Text label="Summary" rows={3} value={edits.summary} onChange={(value) => set((draft) => void (draft.summary = value))} />
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">The client</h2>
        <Text label="First email: subject" rows={1} value={edits.clientEmail.subject} onChange={(value) => set((draft) => void (draft.clientEmail.subject = value))} />
        <Text label="First email: body" rows={5} value={edits.clientEmail.body} onChange={(value) => set((draft) => void (draft.clientEmail.body = value))} />
        <Text label="First thing they say on the call" value={edits.opening} onChange={(value) => set((draft) => void (draft.opening = value))} />
        <p className="text-sm text-white/50">What the client says when a student asks about each fact. The client must not name the concepts.</p>
        {FACTS.map(([role, label]) => (
          <Text key={role} label={label} rows={3} value={edits.replies[role]} onChange={(value) => set((draft) => void (draft.replies[role] = value))} />
        ))}
      </section>

      {edits.concepts && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Handbook concepts</h2>
          {(["problem", "rule"] as const).map((role) => (
            <div key={role} className="space-y-3 rounded-2xl border border-white/10 p-5">
              <p className="text-sm text-white/50">{role === "problem" ? "Behind the problem" : "Behind the rule"}</p>
              {CONCEPT_FIELDS.map(([key, label, rows]) => (
                <Text key={key} label={label} rows={rows} value={edits.concepts![role][key]} onChange={(value) => set((draft) => void (draft.concepts![role][key] = value))} />
              ))}
            </div>
          ))}
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Endings</h2>
        <Text label="When it works" rows={3} value={edits.endings.success} onChange={(value) => set((draft) => void (draft.endings.success = value))} />
        <Text label="When the core problem ships" rows={3} value={edits.endings.failureProblem} onChange={(value) => set((draft) => void (draft.endings.failureProblem = value))} />
        <Text label="When the rule is broken" rows={3} value={edits.endings.failureRule} onChange={(value) => set((draft) => void (draft.endings.failureRule = value))} />
      </section>

      <div className="sticky bottom-4 rounded-2xl border border-white/15 bg-zinc-900/90 p-4 backdrop-blur">
        {result && (
          <div className={`mb-3 text-sm ${result.ok ? "text-emerald-200" : "text-rose-100"}`}>
            <p>{result.text}</p>
            {result.problems && (
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-rose-100/80">
                {result.problems.slice(0, 6).map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => void save()} disabled={busy} className="rounded-full bg-white px-6 py-2.5 text-[15px] font-medium text-black hover:bg-white/85 disabled:opacity-60">
            {busy ? "Checking…" : "Check and save"}
          </button>
          <button type="button" onClick={() => setEdits(initial)} disabled={busy} className="rounded-full border border-white/20 px-5 py-2.5 text-sm text-white/75 hover:border-white/50">
            Undo changes
          </button>
        </div>
      </div>
    </div>
  );
}
