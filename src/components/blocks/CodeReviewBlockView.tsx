"use client";

import { useState } from "react";
import { Markdown } from "@/components/Markdown";
import type { BlockResult, CodeReviewBlock } from "@/lib/types";
import { BlockCard, Feedback } from "./BlockCard";

export function CodeReviewBlockView({
  block,
  result,
  onResult,
}: {
  block: CodeReviewBlock;
  result?: BlockResult;
  onResult: (r: BlockResult) => void;
}) {
  const [picked, setPicked] = useState<number[]>([]);
  const found = picked.some((l) => block.bugLines.includes(l));
  const lines = block.code.split("\n");

  function pick(line: number) {
    if (found || picked.includes(line)) return;
    const next = [...picked, line];
    setPicked(next);
    if (block.bugLines.includes(line) && !result?.done) {
      onResult({ done: true, score: next.length === 1 ? 1 : next.length === 2 ? 0.5 : 0.25 });
    }
  }

  return (
    <BlockCard label="Bug hunt · code review" done={result?.done}>
      <div className="mb-4 text-sm text-stone-700">
        <Markdown compact>{block.context}</Markdown>
      </div>
      <div className="overflow-x-auto rounded-xl bg-stone-900 py-3 font-mono text-[13px] leading-6 text-stone-100">
        {lines.map((text, i) => {
          const n = i + 1;
          const isBug = block.bugLines.includes(n);
          const wasPicked = picked.includes(n);
          const bg = wasPicked ? (isBug ? "bg-emerald-600/40" : "bg-rose-600/30") : found && isBug ? "bg-emerald-600/40" : "hover:bg-white/10";
          return (
            <button
              key={n}
              type="button"
              onClick={() => pick(n)}
              disabled={found}
              className={`flex w-full min-w-max items-start px-3 text-left ${bg} ${found ? "cursor-default" : "cursor-pointer"}`}
            >
              <span className="mr-4 w-6 shrink-0 select-none text-right text-stone-500">{n}</span>
              <span className="whitespace-pre">{text || " "}</span>
            </button>
          );
        })}
      </div>
      {picked.length > 0 && !found && (
        <Feedback ok={false}>That line looks fine. Keep looking, and think about what inputs could break it.</Feedback>
      )}
      {found && (
        <Feedback ok>
          <p className="mb-1 font-semibold">Found it{picked.length === 1 ? " on the first try!" : "!"}</p>
          <Markdown compact>{block.explanation}</Markdown>
        </Feedback>
      )}
    </BlockCard>
  );
}
