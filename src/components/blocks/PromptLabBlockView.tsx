"use client";

import { useState } from "react";
import type { PromptFeedback } from "@/app/api/prompt-lab/route";
import { postJson } from "@/lib/ai/stream-client";
import { useLearner } from "@/lib/learner-store";
import type { BlockResult, PromptLabBlock } from "@/lib/types";
import { BlockCard, buttonPrimary } from "./BlockCard";

export function PromptLabBlockView({
  courseId,
  lessonId,
  block,
  result,
  onResult,
}: {
  courseId: string;
  lessonId: string;
  block: PromptLabBlock;
  result?: BlockResult;
  onResult: (r: BlockResult) => void;
}) {
  const { profile } = useLearner();
  const [draft, setDraft] = useState(block.starter);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<PromptFeedback | null>(null);
  const [showImproved, setShowImproved] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    setShowImproved(false);
    try {
      const res = await postJson<PromptFeedback>("/api/prompt-lab", {
        courseId,
        lessonId,
        blockId: block.id,
        profile,
        draft,
      });
      setFeedback(res);
      const score = res.criteria.filter((c) => c.met).length / res.rubric.length;
      // Keep the best score across attempts.
      onResult({ done: true, score: Math.max(score, result?.score ?? 0) });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const met = feedback?.criteria.filter((c) => c.met).length ?? 0;

  return (
    <BlockCard label="Prompt lab · AI feedback" done={result?.done}>
      <p className="font-medium text-stone-900">{block.task}</p>
      <details className="mt-2 text-sm text-stone-600">
        <summary className="cursor-pointer select-none font-medium text-indigo-600">What makes a good answer?</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {block.rubric.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </details>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={7}
        maxLength={4000}
        className="mt-4 w-full rounded-xl border border-stone-300 p-3 font-mono text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
      />
      <div className="mt-2 flex items-center gap-3">
        <button type="button" className={buttonPrimary} onClick={submit} disabled={busy || !draft.trim()}>
          {busy ? "Reviewing…" : feedback ? "Get feedback on revision" : "Get feedback"}
        </button>
        <span className="text-xs text-stone-500">{draft.length} / 4000</span>
      </div>
      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      {feedback && (
        <div className="mt-5 space-y-3 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 sm:p-5">
          <div className="flex items-baseline justify-between gap-2">
            <h4 className="font-semibold text-stone-900">Feedback</h4>
            <span className="text-sm font-semibold text-indigo-700">
              {met} / {feedback.rubric.length} criteria met
            </span>
          </div>
          <ul className="space-y-2 text-sm">
            {feedback.rubric.map((r, i) => {
              const c = feedback.criteria[i];
              return (
                <li key={i} className="flex gap-2">
                  <span>{c?.met ? "✅" : "⬜️"}</span>
                  <div>
                    <p className="font-medium text-stone-800">{r}</p>
                    {c && <p className="text-stone-600">{c.comment}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="text-sm text-stone-700">{feedback.overall}</p>
          {met < feedback.rubric.length && (
            <p className="text-sm text-stone-600">Revise your draft above and ask for feedback again, or compare with an example.</p>
          )}
          <button type="button" className="text-sm font-medium text-indigo-700 underline" onClick={() => setShowImproved((v) => !v)}>
            {showImproved ? "Hide example" : "Show an example answer"}
          </button>
          {showImproved && (
            <pre className="whitespace-pre-wrap rounded-lg bg-white p-3 font-mono text-xs leading-relaxed text-stone-800">
              {feedback.improved_version}
            </pre>
          )}
        </div>
      )}
    </BlockCard>
  );
}
