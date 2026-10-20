"use client";

import { useState } from "react";
import { Markdown } from "@/components/Markdown";
import type { BlockResult, QuizBlock } from "@/lib/types";
import { BlockCard, Feedback, buttonPrimary } from "./BlockCard";

export function QuizBlockView({
  block,
  result,
  onResult,
}: {
  block: QuizBlock;
  result?: BlockResult;
  onResult: (r: BlockResult) => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const correct = selected === block.answer;

  function check() {
    setChecked(true);
    // First attempt decides the score; later attempts only mark the block done.
    if (!result?.done) onResult({ done: true, score: correct ? 1 : 0 });
  }

  return (
    <BlockCard label="Quick check" done={result?.done}>
      <p className="mb-4 font-medium text-stone-900">{block.question}</p>
      <div className="grid gap-2">
        {block.options.map((opt, i) => {
          const state = !checked
            ? selected === i
              ? "border-indigo-500 bg-indigo-50"
              : "border-stone-200 hover:border-stone-300"
            : i === block.answer
              ? "border-emerald-500 bg-emerald-50"
              : selected === i
                ? "border-amber-500 bg-amber-50"
                : "border-stone-200 opacity-60";
          return (
            <button
              key={i}
              type="button"
              disabled={checked}
              onClick={() => setSelected(i)}
              className={`rounded-xl border px-4 py-3 text-left text-sm transition ${state}`}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {!checked ? (
        <button type="button" className={`${buttonPrimary} mt-4`} disabled={selected === null} onClick={check}>
          Check answer
        </button>
      ) : (
        <Feedback ok={correct}>
          <p className="mb-1 font-semibold">{correct ? "Correct!" : "Not quite."}</p>
          <Markdown compact>{block.explanation}</Markdown>
          {!correct && (
            <button
              type="button"
              className="mt-2 text-sm font-medium underline"
              onClick={() => {
                setChecked(false);
                setSelected(null);
              }}
            >
              Try again
            </button>
          )}
        </Feedback>
      )}
    </BlockCard>
  );
}
