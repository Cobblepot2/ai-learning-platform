"use client";
import { useEffect, useRef, useState } from "react";
import { Markdown } from "@/components/Markdown";
import { buttonPrimary } from "@/components/blocks/BlockCard";
import { isDatabaseCourseId } from "@/lib/learning/ids";
import {
  completionThreshold,
  sameActivityContent,
  validateActivity,
  type ActivityType,
  type LearningActivity,
  type LearningFeedback,
} from "@/lib/learning/registry";
import type { BlockResult, LessonBlock } from "@/lib/types";

type AttemptRow = {
  activity_id?: string;
  lesson_id?: string;
  response: string;
  feedback: LearningFeedback | null;
  activity_snapshot?: unknown;
  score?: number | null;
};

type ViewProps = {
  block: LearningActivity;
  courseId: string;
  lessonId: string;
  preview?: boolean;
  onResult: (result: BlockResult) => void;
};

function useAttempts(props: ViewProps) {
  const onResult = useRef(props.onResult);
  useEffect(() => {
    onResult.current = props.onResult;
  }, [props.onResult]);
  const minimum = completionThreshold(props.block);
  const [history, setHistory] = useState<AttemptRow[]>([]);
  const [feedback, setFeedback] = useState<LearningFeedback | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [savedNote, setSavedNote] = useState("");
  const blockKey = JSON.stringify(props.block);
  useEffect(() => {
    if (props.preview || !isDatabaseCourseId(props.courseId)) return;
    let active = true;
    const snapshot: LearningActivity = JSON.parse(blockKey);
    fetch(`/api/activities?courseId=${props.courseId}`)
      .then((response) => response.json())
      .then((rows) => {
        if (!active || !Array.isArray(rows)) return;
        const mine = (rows as AttemptRow[]).filter(
          (row) => row.activity_id === snapshot.id && row.lesson_id === props.lessonId,
        );
        setHistory(mine);
        if (mine.length) setFeedback(mine[mine.length - 1].feedback);
        onResult.current({
          done: matching(mine, snapshot).length >= completionThreshold(snapshot),
        });
      })
      .catch(() => {
        if (active) setError("Could not load earlier attempts.");
      });
    return () => {
      active = false;
    };
  }, [props.courseId, props.lessonId, props.preview, blockKey]);
  async function submit(response: string): Promise<boolean> {
    setBusy(true);
    setError("");
    try {
      const ephemeral = props.preview || !isDatabaseCourseId(props.courseId);
      const result = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: props.courseId,
          lessonId: props.lessonId,
          activityId: props.block.id,
          response,
          action: "submit",
          preview: !!props.preview,
          previewHistory: ephemeral
            ? history.slice(-8).map((row) => ({
                response: row.response,
                feedback: row.feedback,
              }))
            : undefined,
        }),
      });
      const data = await result.json();
      if (!result.ok) throw new Error(data.error);
      const next: AttemptRow = {
        response: data.response,
        feedback: data.feedback,
        activity_snapshot: data.activity_snapshot,
        score: data.score,
      };
      setFeedback(data.feedback);
      setHistory((current) => [...current, next]);
      setSavedNote(
        data.saved
          ? ""
          : "This attempt is kept in the session only. Preview and the static presentation courses do not write the gradebook.",
      );
      onResult.current({
        done: Boolean(data.complete),
        ...(data.score === null || data.score === undefined ? {} : { score: data.score }),
      });
      return true;
    } catch (cause) {
      setError((cause as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { history, feedback, busy, error, savedNote, submit, minimum };
}

function FeedbackPanel({
  feedback,
  history,
  preview,
  savedNote,
}: {
  feedback: LearningFeedback | null;
  history: AttemptRow[];
  preview?: boolean;
  savedNote: string;
}) {
  return (
    <>
      {preview && (
        <p className="text-sm text-stone-500">Preview: feedback is not saved to student records.</p>
      )}
      {savedNote && <p className="text-sm text-stone-500">{savedNote}</p>}
      {feedback && (
        <div className="space-y-3 rounded-xl bg-indigo-50 p-4">
          {feedback.characterReply && (
            <div>
              <strong>Character response</strong>
              <Markdown>{feedback.characterReply}</Markdown>
            </div>
          )}
          <Markdown>{feedback.summary}</Markdown>
          {feedback.criteria.map((criterion, index) => (
            <div key={index}>
              <strong>
                {criterion.criterion} — {criterion.assessment}
              </strong>
              <p>{criterion.evidence}</p>
              <p>{criterion.suggestion}</p>
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
          {history.map((attempt, index) => (
            <div className="my-3 border-t pt-2" key={index}>
              <p className="whitespace-pre-wrap">{attempt.response}</p>
              <p className="text-sm text-stone-600">{attempt.feedback?.summary}</p>
            </div>
          ))}
        </details>
      )}
    </>
  );
}

function matching(rows: AttemptRow[], block: LearningActivity) {
  return rows.filter((row) => sameActivityContent(row.activity_snapshot ?? block, block));
}

function ChoiceView(props: ViewProps & { block: Extract<LearningActivity, { activityType: "choice" }> }) {
  const [response, setResponse] = useState("");
  const state = useAttempts(props);
  return (
    <section className="space-y-4 rounded-2xl border bg-white p-6">
      <h3 className="text-xl font-semibold">{props.block.config.question}</h3>
      <fieldset className="space-y-2">
        <legend className="sr-only">Choose an answer</legend>
        {props.block.config.options.map((option, index) => (
          <label className="block rounded border p-3" key={index}>
            <input
              type="radio"
              name={props.block.id}
              value={index}
              checked={response === String(index)}
              onChange={(event) => setResponse(event.target.value)}
            />{" "}
            {option}
          </label>
        ))}
      </fieldset>
      <button className={buttonPrimary} disabled={state.busy || !response.trim()} onClick={() => state.submit(response)}>
        {state.busy ? "Checking…" : "Submit answer"}
      </button>
      {state.error && <p role="alert" className="text-red-700">{state.error}</p>}
      <FeedbackPanel feedback={state.feedback} history={state.history} preview={props.preview} savedNote={state.savedNote} />
    </section>
  );
}

function QuizView(props: ViewProps & { block: Extract<LearningActivity, { activityType: "quiz" }> }) {
  const [answers, setAnswers] = useState<(number | null)[]>(
    props.block.config.questions.map(() => null),
  );
  const state = useAttempts(props);
  const complete = answers.every((answer) => answer !== null);
  return (
    <section className="space-y-4 rounded-2xl border bg-white p-6">
      <h3 className="text-xl font-semibold">{props.block.config.title}</h3>
      {props.block.config.questions.map((question, questionIndex) => (
        <fieldset key={questionIndex} className="space-y-2">
          <legend className="font-medium">{questionIndex + 1}. {question.question}</legend>
          {question.options.map((option, optionIndex) => (
            <label className="block rounded border p-3" key={optionIndex}>
              <input
                type="radio"
                name={`${props.block.id}-${questionIndex}`}
                checked={answers[questionIndex] === optionIndex}
                onChange={() =>
                  setAnswers((current) =>
                    current.map((value, index) => (index === questionIndex ? optionIndex : value)),
                  )
                }
              />{" "}
              {option}
            </label>
          ))}
        </fieldset>
      ))}
      <button
        className={buttonPrimary}
        disabled={state.busy || !complete}
        onClick={() => state.submit(JSON.stringify(answers))}
      >
        {state.busy ? "Checking…" : "Submit quiz"}
      </button>
      {state.error && <p role="alert" className="text-red-700">{state.error}</p>}
      <FeedbackPanel feedback={state.feedback} history={state.history} preview={props.preview} savedNote={state.savedNote} />
    </section>
  );
}

function shuffled(items: string[]): string[] {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [next[index], next[swap]] = [next[swap], next[index]];
  }
  return next.every((item, index) => item === items[index]) ? [...next.slice(1), next[0]] : next;
}

function OrderingView(props: ViewProps & { block: Extract<LearningActivity, { activityType: "ordering" }> }) {
  const [order, setOrder] = useState<string[]>(props.block.config.items);
  useEffect(() => setOrder(shuffled(props.block.config.items)), [props.block.config.items]);
  const state = useAttempts(props);
  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
  }
  return (
    <section className="space-y-4 rounded-2xl border bg-white p-6">
      <h3 className="text-xl font-semibold">{props.block.config.prompt}</h3>
      <ol className="grid gap-2">
        {order.map((item, index) => (
          <li key={item} className="flex items-center gap-3 rounded border px-3 py-2">
            <span className="w-6 text-sm text-stone-400">{index + 1}</span>
            <span className="flex-1">{item}</span>
            <button type="button" aria-label={`Move ${item} up`} disabled={index === 0} onClick={() => move(index, -1)}>↑</button>
            <button type="button" aria-label={`Move ${item} down`} disabled={index === order.length - 1} onClick={() => move(index, 1)}>↓</button>
          </li>
        ))}
      </ol>
      <button className={buttonPrimary} disabled={state.busy} onClick={() => state.submit(JSON.stringify(order))}>
        {state.busy ? "Checking…" : "Check order"}
      </button>
      {state.error && <p role="alert" className="text-red-700">{state.error}</p>}
      <FeedbackPanel feedback={state.feedback} history={state.history} preview={props.preview} savedNote={state.savedNote} />
    </section>
  );
}

function CodeReviewView(props: ViewProps & { block: Extract<LearningActivity, { activityType: "code-review" }> }) {
  const config = props.block.config;
  const [picked, setPicked] = useState<number[]>([]);
  const state = useAttempts(props);
  const lines = config.code.split("\n");
  const solved = matching(state.history, props.block).some(
    (row) => typeof row.score === "number" && row.score > 0,
  );

  function pick(line: number) {
    if (solved || state.busy || picked.includes(line)) return;
    const next = [...picked, line];
    setPicked(next);
    if (config.bugLines.includes(line)) {
      void state.submit(JSON.stringify(next));
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border bg-white p-6">
      <Markdown>{config.context}</Markdown>
      <div className="overflow-x-auto rounded-xl bg-stone-900 py-3 font-mono text-[13px] leading-6 text-stone-100">
        {lines.map((text, index) => {
          const line = index + 1;
          const isBug = config.bugLines.includes(line);
          const wasPicked = picked.includes(line);
          const background = wasPicked
            ? isBug
              ? "bg-emerald-600/40"
              : "bg-rose-600/30"
            : solved && isBug
              ? "bg-emerald-600/40"
              : "hover:bg-white/10";
          return (
            <button
              key={line}
              type="button"
              onClick={() => pick(line)}
              disabled={solved || state.busy}
              className={`flex w-full min-w-max items-start px-3 text-left ${background} ${
                solved || state.busy ? "cursor-default" : "cursor-pointer"
              }`}
            >
              <span className="mr-4 w-6 shrink-0 select-none text-right text-stone-500">
                {line}
              </span>
              <span className="whitespace-pre">{text || " "}</span>
            </button>
          );
        })}
      </div>
      {picked.length > 0 && !solved && (
        <p className="text-sm text-stone-600">
          {picked.length} line{picked.length === 1 ? "" : "s"} selected.
          {state.busy ? " Checking…" : " Keep looking if nothing happened."}
        </p>
      )}
      {state.error && <p role="alert" className="text-red-700">{state.error}</p>}
      <FeedbackPanel
        feedback={state.feedback}
        history={state.history}
        preview={props.preview}
        savedNote={state.savedNote}
      />
    </section>
  );
}

function ResponseView(props: ViewProps & { block: Extract<LearningActivity, { activityType: "response" }> }) {
  const [response, setResponse] = useState("");
  const state = useAttempts(props);
  return (
    <section className="space-y-4 rounded-2xl border bg-white p-6">
      <h3 className="text-xl font-semibold">{props.block.config.title}</h3>
      <Markdown>{props.block.config.context}</Markdown>
      <p className="font-medium">{props.block.config.task}</p>
      {props.block.config.persona && <p className="text-sm text-indigo-700">AI role: {props.block.config.persona}</p>}
      <ul className="list-inside list-disc text-sm text-stone-600">
        {props.block.config.rubric.map((item) => <li key={item}>{item}</li>)}
      </ul>
      <textarea
        aria-label="Your response"
        className="min-h-32 w-full rounded border p-3"
        maxLength={8000}
        value={response}
        onChange={(event) => setResponse(event.target.value)}
        placeholder={state.feedback ? "Revise your answer or respond to the next turn…" : "Your response and reasoning…"}
      />
      <button className={buttonPrimary} disabled={state.busy || !response.trim()} onClick={() => state.submit(response)}>
        {state.busy ? "Reviewing…" : state.feedback ? "Submit improvement" : "Submit response"}
      </button>
      {state.error && <p role="alert" className="text-red-700">{state.error}</p>}
      <FeedbackPanel feedback={state.feedback} history={state.history} preview={props.preview} savedNote={state.savedNote} />
    </section>
  );
}

function ConversationView(props: ViewProps & { block: Extract<LearningActivity, { activityType: "conversation" }> }) {
  const [response, setResponse] = useState("");
  const state = useAttempts(props);
  const turns = state.history.length;
  return (
    <section className="space-y-4 rounded-2xl border bg-white p-6">
      <h3 className="text-xl font-semibold">{props.block.config.title}</h3>
      <p className="whitespace-pre-wrap">{props.block.config.scenario}</p>
      <ul className="list-inside list-disc text-sm text-stone-600">
        {props.block.config.goals.map((goal) => <li key={goal}>{goal}</li>)}
      </ul>
      <p className="text-sm text-stone-500">
        {turns} of {state.minimum} turns recorded. Keep going after the minimum if you want another reply.
      </p>
      <div className="space-y-3">
        <div className="rounded-xl bg-stone-100 p-3">
          <p className="text-xs font-semibold uppercase text-stone-500">Character</p>
          <p>{props.block.config.opening}</p>
        </div>
        {state.history.map((turn, index) => (
          <div key={index} className="space-y-2">
            <div className="ml-8 rounded-xl bg-indigo-600 p-3 text-white">
              <p className="whitespace-pre-wrap">{turn.response}</p>
            </div>
            {turn.feedback?.characterReply && (
              <div className="rounded-xl bg-stone-100 p-3">
                <p className="text-xs font-semibold uppercase text-stone-500">Character</p>
                <p className="whitespace-pre-wrap">{turn.feedback.characterReply}</p>
              </div>
            )}
          </div>
        ))}
      </div>
      <textarea
        aria-label="Your message"
        className="min-h-24 w-full rounded border p-3"
        maxLength={8000}
        value={response}
        onChange={(event) => setResponse(event.target.value)}
        placeholder="Your next message…"
      />
      <button
        className={buttonPrimary}
        disabled={state.busy || !response.trim()}
        onClick={() => {
          void state.submit(response).then((ok) => {
            if (ok) setResponse("");
          });
        }}
      >
        {state.busy ? "Waiting…" : "Send"}
      </button>
      {state.error && <p role="alert" className="text-red-700">{state.error}</p>}
      <FeedbackPanel feedback={state.feedback} history={[]} preview={props.preview} savedNote={state.savedNote} />
    </section>
  );
}

const renderers: {
  [K in ActivityType]: (
    props: ViewProps & { block: Extract<LearningActivity, { activityType: K }> },
  ) => React.ReactNode;
} = {
  reading: ({ block }) => <Markdown>{block.config.markdown}</Markdown>,
  choice: (props) => <ChoiceView {...props} />,
  quiz: (props) => <QuizView {...props} />,
  ordering: (props) => <OrderingView {...props} />,
  "code-review": (props) => <CodeReviewView {...props} />,
  response: (props) => <ResponseView {...props} />,
  conversation: (props) => <ConversationView {...props} />,
};

export function ActivityView({
  block,
  courseId,
  lessonId,
  preview,
  onResult,
}: {
  block: Pick<LessonBlock, "type" | "id"> & {
    activityType?: string;
    version?: number;
    config?: unknown;
    objectives?: string[];
  };
  courseId: string;
  lessonId: string;
  preview?: boolean;
  onResult: (result: BlockResult) => void;
}) {
  const parsed = validateActivity(block);
  if (!parsed.success) {
    return (
      <p role="alert" className="rounded border border-red-300 p-4 text-red-700">
        Unsupported activity or invalid configuration: {parsed.error.message}
      </p>
    );
  }
  const Renderer = renderers[parsed.data.activityType] as (
    props: ViewProps & { block: LearningActivity },
  ) => React.ReactNode;
  return (
    <Renderer
      block={parsed.data}
      courseId={courseId}
      lessonId={lessonId}
      preview={preview}
      onResult={onResult}
    />
  );
}
