"use client";

import type { ProjectView } from "@/lib/projects/runtime";
import type { Send } from "../config";

export function LaunchApp({ view, busy, send, onReport }: { view: ProjectView; busy: boolean; send: Send; onReport: () => void }) {
  const deciding = view.stage.id === "release" && view.status === "active";
  const chosen = view.history.find((event) => event.stageId === "release");

  return (
    <div className="h-full overflow-y-auto bg-gradient-to-b from-orange-50 to-white p-5 text-[13px]">
      <h2 className="text-lg font-semibold text-stone-900">Release plan</h2>
      <p className="mt-1 text-stone-600">How does the clinic get the booking board?</p>
      {deciding ? (
        <div className="mt-4 grid gap-2">
          {view.actions.map((action) => (
            <button
              key={action.id}
              type="button"
              disabled={busy}
              onClick={() => void send({ op: "choose", actionId: action.id })}
              className="rounded-xl border border-black/10 bg-white px-4 py-3 text-left font-medium text-stone-800 shadow-sm hover:border-orange-400 disabled:opacity-50"
            >
              {action.label}
            </button>
          ))}
          <p className="mt-1 text-stone-500">Options depend on what you wrote earlier. There&apos;s no undo.</p>
        </div>
      ) : chosen ? (
        <div className="mt-4 space-y-3">
          <p className="rounded-xl border border-black/10 bg-white p-3 text-stone-800">You chose: <span className="font-medium">{chosen.actionLabel}</span></p>
          {view.completion && (
            <button type="button" onClick={onReport} className="rounded-md bg-orange-500 px-3 py-1.5 font-medium text-white">
              Open the project report
            </button>
          )}
        </div>
      ) : (
        <p className="mt-4 text-stone-500">Nothing to release yet.</p>
      )}
    </div>
  );
}
