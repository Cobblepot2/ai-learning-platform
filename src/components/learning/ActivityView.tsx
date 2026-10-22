"use client";
import { useEffect, useRef, useState } from "react";
import { Markdown } from "@/components/Markdown";
import {
  activityDefinitions,
  validateActivity,
  sameActivityContent,
  type LearningActivity,
  type LearningFeedback,
} from "@/lib/learning/registry";
import { buttonPrimary } from "@/components/blocks/BlockCard";
import type { BlockResult } from "@/lib/types";

type Props = {
  block: LearningActivity;
  courseId: string;
  lessonId: string;
  preview?: boolean;
  onResult: (result: BlockResult) => void;
};
export function ActivityView(props: Props) {
  const parsed = validateActivity(props.block);
  if (!parsed.success)
    return (
      <p
        role="alert"
        className="rounded border border-red-300 p-4 text-red-700"
      >
        Unsupported activity or invalid configuration: {parsed.error.message}
      </p>
    );
  const block = parsed.data;
  const renderer = activityDefinitions[block.activityType].renderer;
  if (renderer === "reading" && block.activityType === "reading")
    return <Markdown>{block.config.markdown}</Markdown>;
  if (renderer === "response" && block.activityType !== "reading")
    return <ResponseView {...props} block={block} />;
  return <p role="alert">This activity has no registered renderer.</p>;
}
function ResponseView({
  block,
  courseId,
  lessonId,
  preview,
  onResult,
}: Props & { block: Exclude<LearningActivity, { activityType: "reading" }> }) {
  const resultCallback = useRef(onResult);
  useEffect(() => {
    resultCallback.current = onResult;
  }, [onResult]);
  const [response, setResponse] = useState("");
  const [feedback, setFeedback] = useState<LearningFeedback | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const blockKey = JSON.stringify(block);
  const [history, setHistory] = useState<
    { response: string; feedback: LearningFeedback }[]
  >([]);
  useEffect(() => {
    if (preview) return;
    let active = true;
    const snapshot: LearningActivity = JSON.parse(blockKey);
    fetch(`/api/activities?courseId=${courseId}`)
      .then((r) => r.json())
      .then((rows) => {
        if (!active || !Array.isArray(rows)) return;
        const mine = rows.filter(
          (r) => r.activity_id === snapshot.id && r.lesson_id === lessonId,
        );
        setHistory(mine);
        if (mine.length) {
          setFeedback(mine[mine.length - 1].feedback);
          resultCallback.current({
            done: mine.some((a) =>
              sameActivityContent(a.activity_snapshot, snapshot),
            ),
          });
        } else {
          resultCallback.current({ done: false });
        }
      })
      .catch(() => {
        if (active) setError("Could not load earlier attempts.");
      });
    return () => {
      active = false;
    };
  }, [courseId, lessonId, blockKey, preview]);
  async function submit() {
    setBusy(true);
    setError("");
    try {
      const result = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          lessonId,
          activityId: block.id,
          response,
          action: "submit",
          preview: !!preview,
        }),
      });
      const data = await result.json();
      if (!result.ok) throw new Error(data.error);
      setFeedback(data.feedback);
      setHistory((h) => [...h, data]);
      onResult({
        done: true,
        ...(data.score === null ? {} : { score: data.score }),
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4 rounded-2xl border bg-white p-6">
      <h3 className="text-xl font-semibold">
        {block.activityType === "choice"
          ? block.config.question
          : block.config.title}
      </h3>
      {block.activityType === "choice" ? (
        <fieldset className="space-y-2">
          <legend className="sr-only">Choose an answer</legend>
          {block.config.options.map((option, i) => (
            <label className="block rounded border p-3" key={i}>
              <input
                type="radio"
                name={block.id}
                value={i}
                checked={response === String(i)}
                onChange={(e) => setResponse(e.target.value)}
              />{" "}
              {option}
            </label>
          ))}
        </fieldset>
      ) : (
        <>
          <Markdown>{block.config.context}</Markdown>
          <p className="font-medium">{block.config.task}</p>
          {block.config.persona && (
            <p className="text-sm text-indigo-700">
              AI role: {block.config.persona}
            </p>
          )}
          <ul className="list-inside list-disc text-sm text-stone-600">
            {block.config.rubric.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
          <textarea
            aria-label="Your response"
            className="min-h-32 w-full rounded border p-3"
            maxLength={8000}
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            placeholder={
              feedback
                ? "Revise your answer or respond to the next turn…"
                : "Your response and reasoning…"
            }
          />
        </>
      )}
      <button
        className={buttonPrimary}
        disabled={busy || !response.trim()}
        onClick={submit}
      >
        {busy
          ? "Reviewing…"
          : feedback
            ? "Submit improvement / next turn"
            : "Submit response"}
      </button>
      {preview && (
        <p className="text-sm text-stone-500">
          Preview: feedback is not saved to student records.
        </p>
      )}
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {feedback && (
        <div className="space-y-3 rounded-xl bg-indigo-50 p-4">
          {feedback.characterReply && (
            <div>
              <strong>Character response</strong>
              <Markdown>{feedback.characterReply}</Markdown>
            </div>
          )}
          <Markdown>{feedback.summary}</Markdown>
          {feedback.criteria.map((c, i) => (
            <div key={i}>
              <strong>
                {c.criterion} — {c.assessment}
              </strong>
              <p>{c.evidence}</p>
              <p>{c.suggestion}</p>
            </div>
          ))}
          <p>
            <strong>Next step:</strong> {feedback.nextStep}
          </p>
        </div>
      )}
      {!!history.length && (
        <details>
          <summary>
            {history.length} recorded {preview ? "preview " : ""}attempt(s)
          </summary>
          {history.map((a, i) => (
            <div className="my-3 border-t pt-2" key={i}>
              <p className="whitespace-pre-wrap">{a.response}</p>
              <p className="text-sm text-stone-600">{a.feedback.summary}</p>
            </div>
          ))}
        </details>
      )}
    </section>
  );
}
