"use client";

import { useState } from "react";
import type { ProjectView } from "@/lib/projects/runtime";
import { Avatar } from "../icons";
import type { Send } from "../config";

export function ReviewApp({ view, busy, send }: { view: ProjectView; busy: boolean; send: Send }) {
  const work = view.work;
  const reviewing = view.stage.id === "review" && view.status === "active";
  const [picked, setPicked] = useState<{ path: string; line: number } | null>(null);
  const [reason, setReason] = useState("");
  const engineering = view.track === "engineering";
  const approve = view.actions.find((action) => action.id === "approve");

  if (!work) {
    return <p className="grid h-full place-items-center p-6 text-[13px] text-stone-400">Nothing to review yet. Cody&apos;s work appears here.</p>;
  }

  const failing = work.checks.some((check) => !check.passed);
  const merged = !reviewing;

  return (
    <div className="h-full overflow-y-auto bg-white text-[13px]">
      <div className="border-b border-black/10 px-5 py-4">
        <p className="text-stone-500">harbour-clinic / booking-board</p>
        <h2 className="mt-1 text-lg font-semibold text-stone-900">
          {work.prTitle} <span className="font-normal text-stone-400">#12</span>
        </h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-medium text-white ${merged ? "bg-violet-600" : "bg-emerald-600"}`}>
            {merged ? "Merged" : "Open"}
          </span>
          <span className="text-stone-500">Cody wants to merge into <code className="rounded bg-blue-50 px-1 text-blue-700">main</code></span>
        </div>
      </div>

      <div className="space-y-4 p-5">
        <div className="flex gap-3">
          <Avatar initials="C" tone="from-violet-500 to-fuchsia-500" size={32} />
          <div className="min-w-0 flex-1 rounded-lg border border-black/10">
            <p className="border-b border-black/10 bg-stone-50 px-3 py-1.5 text-stone-500"><span className="font-semibold text-stone-800">Cody</span> commented</p>
            <p className="p-3 text-stone-800">{work.prSummary}</p>
          </div>
        </div>

        {engineering && work.checks.length > 0 && (
          <div className={`rounded-lg border p-3 ${failing ? "border-rose-200 bg-rose-50" : "border-emerald-200 bg-emerald-50"}`}>
            <p className="font-semibold text-stone-900">{failing ? "Some checks were not successful" : "All checks have passed"}</p>
            <ul className="mt-1 space-y-0.5">
              {work.checks.map((check) => (
                <li key={check.name} className={check.passed ? "text-emerald-700" : "text-rose-700"}>
                  {check.passed ? "✓" : "✗"} <span className="font-mono">{check.name}</span>: {check.detail}
                </li>
              ))}
            </ul>
          </div>
        )}

        {engineering ? (
          <div className="space-y-4">
            <p className="font-semibold text-stone-900">Files changed <span className="font-normal text-stone-400">{work.files.length}</span></p>
            {work.files.map((file) => (
              <div key={file.path} className="overflow-hidden rounded-lg border border-black/10">
                <p className="border-b border-black/10 bg-stone-50 px-3 py-1.5 font-mono text-[12px] text-stone-700">{file.path}</p>
                <div className="overflow-x-auto font-mono text-[12.5px] leading-6">
                  {file.lines.map((text, index) => {
                    const line = index + 1;
                    const selected = picked?.path === file.path && picked.line === line;
                    return (
                      <button
                        key={line}
                        type="button"
                        disabled={!reviewing}
                        onClick={() => setPicked(selected ? null : { path: file.path, line })}
                        aria-pressed={selected}
                        className={`flex w-full min-w-max text-left ${selected ? "bg-amber-200" : "bg-emerald-50/60 hover:bg-blue-50"} disabled:cursor-default`}
                      >
                        <span className="w-10 shrink-0 select-none border-r border-black/5 pr-2 text-right text-stone-400">{line}</span>
                        <span className="w-5 shrink-0 select-none text-center text-emerald-600">+</span>
                        <span className="whitespace-pre pr-4 text-stone-800">{text || " "}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="font-semibold text-stone-900">Walkthrough</p>
            {work.demo.map((step, index) => (
              <div key={index} className="rounded-lg border border-black/10 p-3">
                <p className="font-medium text-stone-900">{index + 1}. {step.action}</p>
                <p className="mt-1 text-stone-700">→ {step.result}</p>
              </div>
            ))}
          </div>
        )}

        {work.reviews.length > 0 && (
          <div className="rounded-lg border border-black/10 p-3">
            <p className="font-semibold text-stone-900">Your change requests</p>
            <ul className="mt-1 space-y-0.5 text-stone-700">
              {work.reviews.map((review, index) => (
                <li key={index}>{review.label}: {review.correct ? "Cody fixed it and updated the work." : "Cody found nothing to change."}</li>
              ))}
            </ul>
          </div>
        )}

        {reviewing && (
          <div className="sticky bottom-0 -mx-5 border-t border-black/10 bg-white/95 px-5 py-3 backdrop-blur">
            {!engineering && (
              <fieldset className="mb-3">
                <legend className="font-medium text-stone-900">If you send it back, why?</legend>
                <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                  {work.reasons.map((item) => (
                    <label key={item.id} className={`flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 ${reason === item.id ? "border-blue-500 bg-blue-50" : "border-black/10"}`}>
                      <input type="radio" name="review-reason" value={item.id} checked={reason === item.id} onChange={() => setReason(item.id)} />
                      {item.label}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={busy || (engineering ? !picked : !reason)}
                onClick={async () => {
                  const ok = engineering
                    ? picked && (await send({ op: "request-changes", path: picked.path, line: picked.line }))
                    : await send({ op: "request-changes", reasonId: reason });
                  if (ok) {
                    setPicked(null);
                    setReason("");
                  }
                }}
                className="rounded-md border border-black/15 bg-white px-3 py-1.5 font-medium text-stone-800 shadow-sm disabled:opacity-40"
              >
                {engineering
                  ? picked
                    ? `Request changes on ${picked.path.split("/").pop()}:${picked.line}`
                    : "Click a line to request changes"
                  : "Send it back"}
              </button>
              {approve && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void send({ op: "choose", actionId: approve.id })}
                  className="rounded-md bg-emerald-600 px-3 py-1.5 font-medium text-white shadow-sm disabled:opacity-40"
                >
                  {engineering ? "Approve and merge" : "Approve"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
