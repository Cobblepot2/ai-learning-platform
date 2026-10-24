"use client";

import type { ProjectView } from "@/lib/projects/runtime";
import { Avatar } from "./icons";
import { CAST, STEPS, guideFor, stepIndex, type AppId, type Send } from "./config";

/** Opening sheet: the job, the cast and the choice of role. */
export function Briefing({ view, busy, send, summary }: { view: ProjectView; busy: boolean; send: Send; summary: string }) {
  return (
    <div className="absolute inset-0 z-[945] flex items-center justify-center bg-black/30 px-4 pb-4 pt-10 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="briefing-title" className="max-h-full w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/40 bg-white/95 shadow-2xl backdrop-blur-xl">
        <div className="border-b border-black/10 px-6 py-5">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-orange-600">New job · two weeks</p>
          <h1 id="briefing-title" className="mt-1 text-2xl font-bold text-stone-900">{view.scenario.title}</h1>
          <p className="mt-2 text-[14px] leading-relaxed text-stone-700">{summary}</p>
        </div>
        <div className="grid gap-3 px-6 py-5 sm:grid-cols-2">
          {CAST.map((person) => (
            <div key={person.name} className="flex gap-3 rounded-xl border border-black/10 bg-white p-3">
              <Avatar initials={person.initials} tone={person.tone} size={40} />
              <div className="min-w-0 text-[13px]">
                <p className="font-semibold text-stone-900">{person.name}</p>
                <p className="text-stone-500">{person.role}</p>
                <p className="mt-1 text-stone-700">{person.note}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-black/10 px-6 py-5">
          <p className="text-[13px] font-semibold text-stone-900">Choose your role</p>
          <p className="text-[13px] text-stone-600">Same story, two ways in. You can play the other one later.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {view.actions.map((action) => (
              <button
                key={action.id}
                type="button"
                disabled={busy}
                onClick={() => void send({ op: "choose", actionId: action.id })}
                className="rounded-xl border border-black/10 bg-white px-4 py-3 text-left shadow-sm transition hover:border-blue-500 hover:shadow disabled:opacity-50"
              >
                <span className="block font-semibold text-stone-900">{action.label}</span>
                {action.description && <span className="mt-0.5 block text-[13px] text-stone-600">{action.description}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const OUTCOME: Record<string, { label: string; className: string }> = {
  success: { label: "Success", className: "bg-emerald-50 text-emerald-900 border-emerald-200" },
  partial: { label: "Partly there", className: "bg-amber-50 text-amber-900 border-amber-200" },
  failure: { label: "It went wrong", className: "bg-rose-50 text-rose-900 border-rose-200" },
  incomplete: { label: "Out of time", className: "bg-stone-50 text-stone-900 border-stone-200" },
};
const RATING: Record<string, string> = {
  strong: "bg-emerald-100 text-emerald-800",
  mixed: "bg-amber-100 text-amber-800",
  weak: "bg-rose-100 text-rose-800",
};

/** End-of-project report: outcome plus the four AI Fluency cards. */
export function Report({ view, busy, onClose, onRestart, exitHref }: { view: ProjectView; busy: boolean; onClose: () => void; onRestart: () => void; exitHref: string }) {
  const completion = view.completion;
  if (!completion) return null;
  const outcome = OUTCOME[completion.outcome] ?? OUTCOME.incomplete;
  return (
    <div className="absolute inset-0 z-[945] flex items-center justify-center bg-black/30 px-4 pb-4 pt-10 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="report-title" className="max-h-full w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/40 bg-white/95 shadow-2xl backdrop-blur-xl">
        <div className="px-6 pb-4 pt-6">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-stone-500">Project report</p>
          <h1 id="report-title" className="mt-1 text-2xl font-bold text-stone-900">{view.scenario.title}</h1>
          <div className={`mt-4 rounded-xl border p-4 text-[14px] ${outcome.className}`}>
            <p className="text-[12px] font-semibold uppercase tracking-wide">{outcome.label}</p>
            <p className="mt-1 leading-relaxed">{completion.summary}</p>
          </div>
          <p className="mt-3 text-[14px] text-stone-700">{completion.debrief}</p>
          <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-stone-600">
            <div><dt className="inline">Days used: </dt><dd className="inline font-semibold tabular-nums text-stone-900">{view.meters.effort} of {view.meters.effortMax}</dd></div>
            <div><dt className="inline">Client trust: </dt><dd className="inline font-semibold tabular-nums text-stone-900">{view.meters.trust} / 10</dd></div>
          </dl>
        </div>
        <div className="border-t border-black/10 px-6 py-5">
          <h2 className="text-[15px] font-semibold text-stone-900">How you worked with AI</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {completion.cards.map((card) => (
              <div key={card.competency} className="rounded-xl border border-black/10 bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-stone-900">{card.title}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${RATING[card.rating]}`}>{card.rating}</span>
                </div>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-[13px] text-stone-700">
                  {card.evidence.map((line, index) => <li key={index}>{line}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-black/10 px-6 py-4">
          <a href={exitHref} className="rounded-md border border-black/15 bg-white px-3 py-1.5 text-[13px] font-medium text-stone-800">Leave the desktop</a>
          <button type="button" onClick={onClose} className="rounded-md border border-black/15 bg-white px-3 py-1.5 text-[13px] font-medium text-stone-800">Look around</button>
          <button type="button" disabled={busy} onClick={onRestart} className="rounded-md bg-blue-600 px-3 py-1.5 text-[13px] font-medium text-white disabled:opacity-50">Play again</button>
        </div>
      </div>
    </div>
  );
}

export type Notice = { id: number; app: AppId | null; title: string; body: string };

/** macOS-style notification banners, top right. Click to open the app. */
export function Notifications({ notices, onOpen, onDismiss }: { notices: Notice[]; onOpen: (notice: Notice) => void; onDismiss: (id: number) => void }) {
  return (
    <div className="pointer-events-none absolute right-3 top-9 z-[950] flex w-[22rem] max-w-[calc(100%-1.5rem)] flex-col gap-2" aria-live="polite">
      {notices.map((notice) => (
        <div key={notice.id} className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-white/50 bg-white/85 p-3 text-[13px] shadow-xl backdrop-blur-xl">
          <button type="button" onClick={() => onOpen(notice)} className="min-w-0 flex-1 text-left">
            <p className="font-semibold text-stone-900">{notice.title}</p>
            <p className="mt-0.5 text-stone-700">{notice.body}</p>
          </button>
          <button type="button" aria-label="Dismiss" onClick={() => onDismiss(notice.id)} className="rounded-full px-1.5 text-stone-400 hover:bg-black/5 hover:text-stone-700">×</button>
        </div>
      ))}
    </div>
  );
}

/** The desktop widget that keeps the learner oriented: budget, trust, steps, guide, log. */
export function ProjectWidget({ view, onOpenApp }: { view: ProjectView; onOpenApp: (app: AppId) => void }) {
  const current = stepIndex(view);
  const { effort, effortMax, trust } = view.meters;
  const guide = guideFor(view);
  return (
    <aside className="absolute right-3 top-10 z-[5] hidden w-72 space-y-3 xl:block">
      <div className="rounded-2xl border border-white/40 bg-white/70 p-4 shadow-lg backdrop-blur-xl">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">Harbour Clinic · {view.track === "engineering" ? "Tech lead" : "Product lead"}</p>
        <div className="mt-2 grid grid-cols-2 gap-3 text-[13px]">
          <Meter label="Days used" value={effort} max={effortMax} warn={effort >= effortMax - 2} />
          <Meter label="Client trust" value={trust} max={10} warn={trust <= 3} />
        </div>
      </div>
      <div className="rounded-2xl border border-white/40 bg-white/70 p-4 shadow-lg backdrop-blur-xl">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">Steps · {Math.min(current, STEPS.length)} of {STEPS.length}</p>
        <ol className="mt-2 space-y-1 text-[13px]">
          {STEPS.map((step, index) => {
            const state = index < current ? "done" : index === current ? "now" : "next";
            return (
              <li key={step.id}>
                <button
                  type="button"
                  onClick={() => onOpenApp(step.app)}
                  disabled={state === "next"}
                  className={`flex w-full items-start gap-2 rounded-md px-1.5 py-1 text-left ${state === "now" ? "bg-blue-500/10 font-semibold text-stone-900" : state === "done" ? "text-stone-500" : "text-stone-400"}`}
                >
                  <span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] ${state === "done" ? "bg-emerald-500 text-white" : state === "now" ? "bg-blue-500 text-white" : "border border-stone-300"}`}>
                    {state === "done" ? "✓" : index + 1}
                  </span>
                  {step.label}
                </button>
              </li>
            );
          })}
        </ol>
        {guide.length > 0 && (
          <div className="mt-3 rounded-xl bg-blue-500/10 p-3 text-[12.5px] text-stone-800">
            <p className="mb-1 font-semibold">What to do</p>
            <ul className="list-disc space-y-1 pl-4">{guide.map((line) => <li key={line}>{line}</li>)}</ul>
          </div>
        )}
      </div>
      {view.history.length > 0 && (
        <div className="max-h-48 overflow-y-auto rounded-2xl border border-white/40 bg-white/70 p-4 shadow-lg backdrop-blur-xl">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">Activity</p>
          <ul className="mt-2 space-y-1.5 text-[12.5px] text-stone-700">
            {[...view.history].reverse().map((event) => <li key={event.step}>{event.feedback}</li>)}
          </ul>
        </div>
      )}
    </aside>
  );
}

function Meter({ label, value, max, warn }: { label: string; value: number; max: number; warn: boolean }) {
  return (
    <div>
      <p className="text-stone-500">{label}</p>
      <p className={`font-semibold tabular-nums ${warn ? "text-rose-600" : "text-stone-900"}`}>{value} / {max}</p>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/10">
        <div className={`h-full rounded-full ${warn ? "bg-rose-500" : "bg-blue-500"}`} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
      </div>
    </div>
  );
}
