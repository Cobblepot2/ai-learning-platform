"use client";

import { useEffect, useState } from "react";
import type { BlockResult, OrderingBlock } from "@/lib/types";
import { BlockCard, Feedback, buttonPrimary } from "./BlockCard";

function shuffled(items: string[]): string[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  // Never start already solved.
  return out.every((v, i) => v === items[i]) ? [...out.slice(1), out[0]] : out;
}

export function OrderingBlockView({
  block,
  result,
  onResult,
}: {
  block: OrderingBlock;
  result?: BlockResult;
  onResult: (r: BlockResult) => void;
}) {
  // Shuffle after mount so server and client render the same initial markup.
  const [order, setOrder] = useState<string[]>(block.items);
  useEffect(() => setOrder(shuffled(block.items)), [block.items]);
  const [checked, setChecked] = useState(false);
  const [attempts, setAttempts] = useState(0);

  const correctCount = order.filter((v, i) => v === block.items[i]).length;
  const solved = correctCount === block.items.length;

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
    setChecked(false);
  }

  function check() {
    setChecked(true);
    setAttempts((a) => a + 1);
    if (solved && !result?.done) onResult({ done: true, score: attempts === 0 ? 1 : 0.5 });
  }

  return (
    <BlockCard label="Mini-game · put in order" done={result?.done}>
      <p className="mb-4 font-medium text-stone-900">{block.prompt}</p>
      <ol className="grid gap-2">
        {order.map((item, i) => {
          const status = checked ? (item === block.items[i] ? "border-emerald-400 bg-emerald-50" : "border-amber-400 bg-amber-50") : "border-stone-200 bg-white";
          return (
            <li key={item} className={`flex items-center gap-3 rounded-xl border px-3 py-2 transition ${status}`}>
              <span className="w-6 text-center text-sm font-semibold text-stone-400">{i + 1}</span>
              <span className="flex-1 text-sm">{item}</span>
              <div className="flex gap-1">
                <button type="button" aria-label={`Move ${item} up`} className="rounded-md px-2 py-1 text-stone-500 hover:bg-stone-100 disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)}>
                  ↑
                </button>
                <button type="button" aria-label={`Move ${item} down`} className="rounded-md px-2 py-1 text-stone-500 hover:bg-stone-100 disabled:opacity-30" disabled={i === order.length - 1} onClick={() => move(i, 1)}>
                  ↓
                </button>
              </div>
            </li>
          );
        })}
      </ol>
      <button type="button" className={`${buttonPrimary} mt-4`} onClick={check}>
        Check order
      </button>
      {checked && (
        <Feedback ok={solved}>
          {solved ? (
            <>
              <p className="mb-1 font-semibold">Perfect order!</p>
              <p>{block.explanation}</p>
            </>
          ) : (
            <p>
              {correctCount} of {block.items.length} in the right place. Items highlighted in amber need to move.
            </p>
          )}
        </Feedback>
      )}
    </BlockCard>
  );
}
