"use client";

import { useEffect, useRef, useState } from "react";
import type { ProjectView } from "@/lib/projects/runtime";
import { Avatar } from "../icons";
import type { Send } from "../config";

export function CallApp({ view, busy, send }: { view: ProjectView; busy: boolean; send: Send }) {
  const [question, setQuestion] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const live = view.stage.id === "interview" && view.status === "active";
  const { turns, asked, min, max, opening } = view.interview;
  const client = view.scenario.client;
  const happened = live || turns.length > 0;

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [turns.length]);

  if (!happened) {
    return (
      <div className="grid h-full place-items-center bg-stone-900 p-6 text-center text-stone-300">
        <div>
          <Avatar initials="GW" tone="from-rose-400 to-orange-400" size={72} />
          <p className="mt-3 text-sm">No calls yet.</p>
        </div>
      </div>
    );
  }

  async function ask(event: React.FormEvent) {
    event.preventDefault();
    const text = question.trim();
    if (!text || busy) return;
    // Clear straight away so the learner can type the next question while Grace answers.
    setQuestion("");
    if (!(await send({ op: "ask", question: text }))) setQuestion((current) => current || text);
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-stone-900 text-[13px] text-stone-100 md:flex-row">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <div className="relative">
            <Avatar initials="GW" tone="from-rose-400 to-orange-400" size={44} />
            {live && <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-stone-900 bg-emerald-400" />}
          </div>
          <div className="min-w-0">
            <p className="font-semibold">{client.name}</p>
            <p className="text-stone-400">{client.role}, {client.organisation}</p>
          </div>
          <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-medium ${live ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-stone-400"}`}>
            {live ? "On call" : "Call ended"}
          </span>
        </div>
        <div ref={scroller} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
          <Line who={client.name} text={opening} />
          {turns.map((turn, index) =>
            turn.role === "learner" ? <Line key={index} mine text={turn.text} /> : <Line key={index} who={client.name} text={turn.text} />,
          )}
          {busy && live && <p className="text-stone-400">Grace is thinking…</p>}
        </div>
        {live && (
          <div className="border-t border-white/10 p-3">
            <form onSubmit={ask} className="flex gap-2">
              <label htmlFor="meet-question" className="sr-only">Your question</label>
              <input
                id="meet-question"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                maxLength={500}
                disabled={asked >= max}
                placeholder={asked >= max ? "Grace has to go. End the call." : "Ask Grace a question…"}
                className="min-w-0 flex-1 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-stone-100 placeholder:text-stone-400 outline-none focus:border-emerald-400"
              />
              <button type="submit" disabled={busy || !question.trim() || asked >= max} className="rounded-full bg-emerald-500 px-4 py-2 font-medium text-white disabled:opacity-40">
                Ask
              </button>
            </form>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="tabular-nums text-stone-400">
                {asked} of {max} questions{asked < min ? ` · ask ${min - asked} more before hanging up` : ""}
              </span>
              <button
                type="button"
                disabled={busy || asked < min}
                onClick={() => void send({ op: "end-interview" })}
                className="rounded-full bg-[#ff5f57] px-4 py-1.5 font-medium text-white disabled:opacity-40"
              >
                End call
              </button>
            </div>
          </div>
        )}
      </div>
      <aside className="max-h-48 shrink-0 overflow-y-auto border-t border-white/10 bg-black/20 p-4 md:max-h-none md:w-64 md:border-l md:border-t-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">What you know</p>
        {view.notes.length ? (
          <ul className="mt-2 space-y-2">
            {view.notes.map((note) => (
              <li key={note} className="rounded-lg bg-white/5 p-2 text-stone-200">{note}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-stone-500">Facts appear here as Grace mentions them.</p>
        )}
      </aside>
    </div>
  );
}

function Line({ who, text, mine = false }: { who?: string; text: string; mine?: boolean }) {
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 leading-relaxed ${mine ? "bg-emerald-600 text-white" : "bg-white/10 text-stone-100"}`}>
        {who && <p className="mb-0.5 text-[11px] font-semibold text-rose-300">{who}</p>}
        {text}
      </div>
    </div>
  );
}
