"use client";

import { useState } from "react";
import type { ProjectView } from "@/lib/projects/runtime";
import { Avatar } from "../icons";
import type { Send } from "../config";

/** Cody, the AI coding agent: the learner writes its task here. */
export function CodyApp({ view, busy, send, onOpenReview }: { view: ProjectView; busy: boolean; send: Send; onOpenReview: () => void }) {
  const writing = view.stage.id === "brief" && view.status === "active";
  const [text, setText] = useState("");
  const engineering = view.track === "engineering";

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#14121c] font-mono text-[13px] text-violet-100">
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3 font-sans">
        <Avatar initials="C" tone="from-violet-500 to-fuchsia-500" size={32} />
        <div>
          <p className="font-semibold text-white">Cody</p>
          <p className="text-[12px] text-violet-300/70">Autonomous coding agent · builds exactly what the task says</p>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <p className="text-violet-300/80">
          <span className="text-fuchsia-400">cody</span> ready. Waiting for a task for <span className="text-white">harbour-clinic/booking-board</span>.
        </p>
        {view.brief && (
          <>
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="mb-1 text-[11px] uppercase tracking-wide text-violet-300/60">Your task</p>
              <p className="whitespace-pre-line font-sans text-[13px] text-white">{view.brief.text}</p>
            </div>
            <div className="space-y-1 text-violet-200/80">
              <p>▸ reading task… done</p>
              <p>▸ planning changes… done</p>
              <p>▸ writing code and migrations… done</p>
              <p className="text-emerald-300">✓ {engineering ? "opened a pull request" : "recorded a walkthrough"}: {view.work?.prTitle ?? "booking board"}</p>
            </div>
            {view.work && (
              <button type="button" onClick={onOpenReview} className="rounded-md bg-violet-600 px-3 py-1.5 font-sans font-medium text-white hover:bg-violet-500">
                Open in Review
              </button>
            )}
            {view.work && view.work.reviews.length > 0 && (
              <div className="space-y-1 text-violet-200/80">
                {view.work.reviews.map((review, index) => (
                  <p key={index}>
                    ▸ change request: {review.label} →{" "}
                    {review.correct ? <span className="text-emerald-300">fixed and updated</span> : <span className="text-amber-300">nothing to change for that reason</span>}
                  </p>
                ))}
              </div>
            )}
          </>
        )}
        {!view.brief && !writing && (
          <p className="text-violet-300/60">You&apos;ll brief Cody once the requirements are written.</p>
        )}
      </div>
      {writing && (
        <form
          className="border-t border-white/10 p-3 font-sans"
          onSubmit={(event) => {
            event.preventDefault();
            void send({ op: "brief", text });
          }}
        >
          <label htmlFor="cody-task" className="text-[12px] font-medium text-violet-200">Task for Cody</label>
          <textarea
            id="cody-task"
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={6}
            maxLength={3000}
            placeholder={
              engineering
                ? "Describe the task, the constraints Cody must respect, what's out of scope and how you'll check the result."
                : "Describe what Cody should build, what it must never do, and what's out of scope."
            }
            className="mt-1 w-full resize-y rounded-lg border border-white/15 bg-white/5 p-3 text-[13px] text-white placeholder:text-violet-300/40 outline-none focus:border-fuchsia-400"
          />
          <div className="mt-2 flex items-center gap-3">
            <button type="submit" disabled={busy || !text.trim()} className="rounded-md bg-fuchsia-600 px-4 py-1.5 font-medium text-white disabled:opacity-40">
              {busy ? "Cody is working…" : "Run task"}
            </button>
            <span className="tabular-nums text-violet-300/60">{text.length} / 3000</span>
          </div>
        </form>
      )}
    </div>
  );
}
