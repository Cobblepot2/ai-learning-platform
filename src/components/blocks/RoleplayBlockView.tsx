"use client";

import { useEffect, useRef, useState } from "react";
import type { DebriefResult } from "@/app/api/roleplay/route";
import { Markdown } from "@/components/Markdown";
import { postJson, postStream } from "@/lib/ai/stream-client";
import type { ChatTurn } from "@/lib/ai/claude";
import { useLearner } from "@/lib/learner-store";
import type { BlockResult, RoleplayBlock } from "@/lib/types";
import { BlockCard, buttonPrimary, buttonSecondary } from "./BlockCard";

export function RoleplayBlockView({
  courseId,
  lessonId,
  block,
  result,
  onResult,
}: {
  courseId: string;
  lessonId: string;
  block: RoleplayBlock;
  result?: BlockResult;
  onResult: (r: BlockResult) => void;
}) {
  const { profile, logEvent } = useLearner();
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debrief, setDebrief] = useState<DebriefResult | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const userTurns = turns.filter((t) => t.role === "user").length;
  const ids = { courseId, lessonId, blockId: block.id, profile };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question || busy) return;
    const history: ChatTurn[] = [...turns, { role: "user", content: question }];
    setTurns([...history, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    setError(null);
    try {
      await postStream("/api/roleplay", { ...ids, messages: history }, (text) =>
        setTurns([...history, { role: "assistant", content: text }]),
      );
      logEvent(courseId, lessonId, "roleplay_turn", { blockId: block.id });
    } catch (err) {
      setError((err as Error).message);
      setTurns(history.slice(0, -1));
      setInput(question);
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    setBusy(true);
    setError(null);
    try {
      const res = await postJson<DebriefResult>("/api/roleplay", { ...ids, messages: turns, mode: "debrief" });
      setDebrief(res);
      onResult({ done: true, score: res.uncovered.length / res.total });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function restart() {
    setTurns([]);
    setDebrief(null);
    setError(null);
  }

  return (
    <BlockCard label="AI role-play · requirements interview" done={result?.done}>
      <h3 className="text-lg font-semibold text-stone-900">{block.title}</h3>
      <p className="mt-1 text-sm text-stone-600">{block.scenario}</p>

      <div ref={scrollRef} className="mt-4 max-h-[420px] space-y-3 overflow-y-auto rounded-xl bg-stone-50 p-3 sm:p-4">
        <Bubble role="assistant" text={block.openingLine} />
        {turns.map((t, i) => (
          <Bubble key={i} role={t.role} text={t.content} />
        ))}
      </div>

      {!debrief && (
        <>
          <form onSubmit={send} className="mt-3 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask the client a question…"
              maxLength={1000}
              className="min-w-0 flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
            <button type="submit" className={buttonPrimary} disabled={busy || !input.trim()}>
              Ask
            </button>
          </form>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" className={buttonSecondary} onClick={finish} disabled={busy || userTurns < block.minTurns}>
              End interview & get feedback
            </button>
            <span className="text-xs text-stone-500">
              {userTurns < block.minTurns
                ? `Ask at least ${block.minTurns - userTurns} more question${block.minTurns - userTurns === 1 ? "" : "s"} first`
                : `${userTurns} questions asked`}
            </span>
          </div>
        </>
      )}

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      {debrief && (
        <div className="mt-5 space-y-4 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 sm:p-5">
          <div className="flex items-baseline justify-between gap-2">
            <h4 className="font-semibold text-stone-900">Interview debrief</h4>
            <span className="text-sm font-semibold text-indigo-700">
              {debrief.uncovered.length} / {debrief.total} needs uncovered
            </span>
          </div>
          <p className="text-sm text-stone-700">{debrief.summary}</p>
          <ul className="space-y-1.5 text-sm">
            {debrief.requirements.map((r, i) => {
              const hit = debrief.uncovered.includes(i);
              return (
                <li key={i} className={`flex gap-2 ${hit ? "text-stone-800" : "text-stone-500"}`}>
                  <span>{hit ? "✅" : "⬜️"}</span>
                  <span>{r}</span>
                </li>
              );
            })}
          </ul>
          <FeedbackList title="What went well" items={debrief.strengths} />
          <FeedbackList title="Try next time" items={debrief.improvements} />
          <div className="text-sm">
            <p className="font-medium text-stone-800">A question worth asking</p>
            <p className="mt-1 italic text-stone-700">“{debrief.example_question}”</p>
          </div>
          <button type="button" className={buttonSecondary} onClick={restart}>
            Try the interview again
          </button>
        </div>
      )}
    </BlockCard>
  );
}

function Bubble({ role, text }: { role: "user" | "assistant"; text: string }) {
  const mine = role === "user";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm leading-relaxed ${
          mine ? "bg-indigo-600 text-white" : "border border-stone-200 bg-white text-stone-800"
        }`}
      >
        {!mine && <p className="mb-0.5 text-xs font-semibold text-indigo-600">Client</p>}
        {text ? mine ? text : <Markdown compact>{text}</Markdown> : <span className="animate-pulse text-stone-400">typing…</span>}
      </div>
    </div>
  );
}

function FeedbackList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="text-sm">
      <p className="font-medium text-stone-800">{title}</p>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-stone-700">
        {items.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </div>
  );
}
