"use client";

import { useState } from "react";
import type { ProjectView } from "@/lib/projects/runtime";
import type { Send } from "../config";

/** Notes: the call notes (facts) and the requirements note the learner writes. */
export function NotesApp({ view, busy, send }: { view: ProjectView; busy: boolean; send: Send }) {
  const writing = view.stage.id === "requirements" && view.status === "active";
  const [text, setText] = useState("");
  const [doc, setDoc] = useState<"requirements" | "call">("requirements");

  return (
    <div className="flex h-full min-h-0 text-[13px]">
      <nav className="w-44 shrink-0 border-r border-black/10 bg-[#f6f3e8] p-2 max-sm:hidden">
        <p className="px-2 pb-1 pt-1 text-[11px] font-semibold text-stone-400">Harbour Clinic</p>
        {[
          { id: "requirements" as const, label: "Requirements", meta: view.requirements ? "Saved" : writing ? "Draft" : "Empty" },
          { id: "call" as const, label: "Call notes", meta: `${view.notes.length} facts` },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setDoc(item.id)}
            className={`block w-full rounded-md px-2 py-1.5 text-left ${doc === item.id ? "bg-amber-200/70" : "hover:bg-black/5"}`}
          >
            <span className="block font-medium text-stone-800">{item.label}</span>
            <span className="block text-[11px] text-stone-500">{item.meta}</span>
          </button>
        ))}
      </nav>
      <div className="min-w-0 flex-1 overflow-y-auto bg-[#fffdf6] p-5">
        <div className="mb-3 flex gap-2 sm:hidden">
          {(["requirements", "call"] as const).map((id) => (
            <button key={id} type="button" onClick={() => setDoc(id)} className={`rounded-full px-3 py-1 ${doc === id ? "bg-amber-200" : "bg-black/5"}`}>
              {id === "requirements" ? "Requirements" : "Call notes"}
            </button>
          ))}
        </div>
        {doc === "call" ? (
          <>
            <h2 className="text-xl font-bold text-stone-900">Call notes</h2>
            {view.notes.length ? (
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[14px] text-stone-800">
                {view.notes.map((note) => <li key={note}>{note}</li>)}
              </ul>
            ) : (
              <p className="mt-3 text-stone-500">Nothing yet. Facts from your call with Grace land here.</p>
            )}
          </>
        ) : view.requirements ? (
          <>
            <h2 className="text-xl font-bold text-stone-900">Requirements</h2>
            <p className="mt-1 text-stone-500">Shared with the team.</p>
            <p className="mt-4 whitespace-pre-line text-[14px] leading-relaxed text-stone-800">{view.requirements.text}</p>
          </>
        ) : writing ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void send({ op: "requirements", text });
            }}
          >
            <label htmlFor="requirements-note" className="text-xl font-bold text-stone-900">Requirements</label>
            <p className="mt-1 text-stone-600">
              What must the booking board do, what must it never do, and how will you know it worked? Use what Grace told you.
            </p>
            <textarea
              id="requirements-note"
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={12}
              maxLength={3000}
              placeholder="Start typing…"
              className="mt-4 w-full resize-y rounded-lg border border-black/10 bg-white/70 p-3 text-[14px] leading-relaxed outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
            />
            <div className="mt-2 flex items-center gap-3">
              <button type="submit" disabled={busy || !text.trim()} className="rounded-md bg-amber-500 px-4 py-1.5 font-medium text-white shadow-sm disabled:opacity-40">
                {busy ? "Sharing…" : "Share with the team"}
              </button>
              <span className="tabular-nums text-stone-400">{text.length} / 3000</span>
            </div>
          </form>
        ) : (
          <p className="text-stone-500">You&apos;ll write the requirements after the call with Grace.</p>
        )}
      </div>
    </div>
  );
}
