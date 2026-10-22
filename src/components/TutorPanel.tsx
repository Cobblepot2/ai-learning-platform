"use client";

import { useEffect, useRef, useState } from "react";
import { Markdown } from "@/components/Markdown";
import type { ChatTurn } from "@/lib/ai/gemini";
import { postStream } from "@/lib/ai/stream-client";
import { useLearner } from "@/lib/learner-store";

const SUGGESTIONS = [
  "Explain this lesson in simpler words",
  "Give me an example from everyday life",
  "How does this matter in a real job?",
  "Quiz me on this lesson",
];

export function TutorPanel({ courseId, lessonId }: { courseId: string; lessonId: string }) {
  const { profile, coursePreferences, logEvent } = useLearner();
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [turns]);

  // A fresh conversation per lesson.
  useEffect(() => setTurns([]), [courseId, lessonId]);

  async function ask(question: string) {
    question = question.trim();
    if (!question || busy) return;
    // Keep the request small: only the most recent turns go to the server.
    const history: ChatTurn[] = [...turns, { role: "user" as const, content: question }].slice(-20);
    setTurns([...history, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    setError(null);
    try {
      await postStream("/api/tutor", { courseId, lessonId, profile, coursePreference: coursePreferences[courseId] ?? null, messages: history }, (text) =>
        setTurns([...history, { role: "assistant", content: text }]),
      );
      logEvent(courseId, lessonId, "tutor_message");
    } catch (err) {
      setError((err as Error).message);
      setTurns(history.slice(0, -1));
      setInput(question);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-stone-200 px-4 py-3">
        <p className="font-semibold text-stone-900">AI Tutor</p>
        <p className="text-xs text-stone-500">Knows this lesson and adapts to your profile</p>
      </div>
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {turns.length === 0 && (
          <div className="space-y-2">
            <p className="text-sm text-stone-600">
              Hi{profile?.displayName ? ` ${profile.displayName}` : ""}! Stuck, curious or want a different explanation? Ask me anything about this lesson.
            </p>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => ask(s)}
                className="block w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-left text-sm text-stone-700 transition hover:border-indigo-300 hover:bg-indigo-50"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {turns.map((t, i) =>
          t.role === "user" ? (
            <div key={i} className="ml-8 rounded-2xl bg-indigo-600 px-3 py-2 text-sm text-white">
              {t.content}
            </div>
          ) : (
            <div key={i} className="mr-4 rounded-2xl border border-stone-200 bg-white px-3 py-2">
              {t.content ? <Markdown compact>{t.content}</Markdown> : <span className="animate-pulse text-sm text-stone-400">Thinking…</span>}
            </div>
          ),
        )}
        {error && <p className="text-sm text-rose-600">{error}</p>}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(input);
        }}
        className="flex gap-2 border-t border-stone-200 p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the tutor…"
          maxLength={2000}
          className="min-w-0 flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        />
        <button type="submit" disabled={busy || !input.trim()} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
          Send
        </button>
      </form>
    </div>
  );
}
