"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Markdown } from "@/components/Markdown";
import { buttonPrimary } from "@/components/blocks/BlockCard";
import { isDatabaseCourseId } from "@/lib/learning/ids";
import type { LearningActivity, LearningFeedback } from "@/lib/learning/registry";
import {
  applySimulationAction,
  simulationView,
  startSimulation,
  type SimulationEvent,
  type SimulationPublicView,
  type SimulationState,
} from "@/lib/learning/simulation/engine";
import {
  isLearnerSimulation,
  type LearnerSimulationActivity,
} from "@/lib/learning/simulation/public";
import type { SimulationConfig, SimulationOutcome } from "@/lib/learning/simulation/schema";
import type { BlockResult } from "@/lib/types";

type SimulationBlock = Extract<LearningActivity, { activityType: "simulation" }>;
type PlayableSimulation = SimulationBlock | LearnerSimulationActivity;

type Props = {
  block: PlayableSimulation;
  courseId: string;
  lessonId: string;
  preview?: boolean;
  result?: BlockResult;
  onResult: (result: BlockResult) => void;
};

function engineConfig(block: PlayableSimulation): SimulationConfig | null {
  return isLearnerSimulation(block) ? null : block.config;
}

type Mode = "loading" | "server" | "local";

const outcomeStyles: Record<
  SimulationOutcome,
  { label: string; className: string }
> = {
  success: {
    label: "Goal reached",
    className: "border-emerald-300 bg-emerald-50 text-emerald-900",
  },
  partial: {
    label: "Partly successful",
    className: "border-amber-300 bg-amber-50 text-amber-900",
  },
  failure: {
    label: "Goal missed",
    className: "border-rose-300 bg-rose-50 text-rose-900",
  },
  incomplete: {
    label: "Scenario ended early",
    className: "border-stone-300 bg-stone-100 text-stone-800",
  },
};

function valueText(value: number | boolean | string): string {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function VariablePanel({ view }: { view: SimulationPublicView }) {
  if (!view.variables.length) return null;
  return (
    <section aria-label="Current state" className="rounded-2xl border border-stone-200 bg-white p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
        Current state
      </h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {view.variables.map((variable) => {
          const percent =
            variable.type === "number" &&
            typeof variable.min === "number" &&
            typeof variable.max === "number" &&
            variable.max > variable.min
              ? Math.round(
                  ((Number(variable.value) - variable.min) /
                    (variable.max - variable.min)) *
                    100,
                )
              : null;
          return (
            <div key={variable.id} className="rounded-xl bg-stone-50 p-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-medium text-stone-700">{variable.label}</p>
                <p className="font-semibold text-stone-900">
                  {valueText(variable.value)}
                  {variable.unit && variable.type === "number" ? ` ${variable.unit}` : ""}
                </p>
              </div>
              {percent !== null && (
                <div
                  className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-200"
                  role="progressbar"
                  aria-valuenow={percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${variable.label} level`}
                >
                  <div
                    className="h-full rounded-full bg-indigo-500 transition-all"
                    style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
                  />
                </div>
              )}
              {variable.type === "enum" && variable.options?.length ? (
                <p className="mt-1 text-xs text-stone-500">
                  Possible: {variable.options.join(" · ")}
                </p>
              ) : null}
              {variable.description && (
                <p className="mt-1 text-xs text-stone-500">{variable.description}</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function eventChanges(event: { changes: SimulationEvent["changes"] }): string[] {
  return event.changes.map(
    (change) => `${change.label}: ${valueText(change.from)} → ${valueText(change.to)}`,
  );
}

function HistoryPanel({
  events,
  title,
}: {
  events: SimulationPublicView["history"];
  title: string;
}) {
  if (!events.length) return null;
  return (
    <details className="rounded-2xl border border-stone-200 bg-white p-5">
      <summary className="cursor-pointer text-sm font-medium text-stone-700">
        {title}
      </summary>
      <ol className="mt-3 space-y-3">
        {events.map((event) => (
          <li key={event.step} className="rounded-xl bg-stone-50 p-3 text-sm">
            <p className="font-medium text-stone-800">
              Step {event.step}: {event.actionLabel}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-stone-600">{event.feedback}</p>
            {!!event.changes.length && (
              <ul className="mt-2 flex flex-wrap gap-2 text-xs text-indigo-800">
                {event.changes.map((change, index) => (
                  <li key={index} className="rounded-full bg-indigo-100 px-2 py-1">
                    {change.label}: {valueText(change.from)} → {valueText(change.to)}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </details>
  );
}

function CompletionPanel({
  view,
  feedback,
  busy,
  onRestart,
}: {
  view: SimulationPublicView;
  feedback: LearningFeedback | null;
  busy: boolean;
  onRestart: () => void;
}) {
  if (!view.completion) return null;
  const style = outcomeStyles[view.completion.outcome];
  return (
    <section aria-live="polite" className={`space-y-4 rounded-2xl border p-5 ${style.className}`}>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
          Simulation complete
        </p>
        <h3 className="text-xl font-semibold">{style.label}</h3>
      </div>
      <p className="whitespace-pre-wrap">{view.completion.summary}</p>
      <div>
        <h4 className="font-semibold">What this run shows</h4>
        <Markdown>{view.completion.debrief}</Markdown>
      </div>
      {feedback && (
        <div className="space-y-2 rounded-xl bg-white/70 p-4">
          <h4 className="font-semibold">Feedback on your decisions</h4>
          <p className="whitespace-pre-wrap">{feedback.summary}</p>
          {feedback.criteria.map((criterion, index) => (
            <div key={index}>
              <p className="font-medium">
                {criterion.criterion} — {criterion.assessment}
              </p>
              <p className="text-sm opacity-90">{criterion.evidence}</p>
              <p className="text-sm opacity-90">{criterion.suggestion}</p>
            </div>
          ))}
          <p className="text-sm">
            <strong>Next step:</strong> {feedback.nextStep}
          </p>
        </div>
      )}
      <div>
        <h4 className="font-semibold">How your decisions were judged</h4>
        <ul className="mt-1 list-inside list-disc text-sm">
          {view.completion.rubric.map((item) => (
            <li key={item.id}>
              {item.criterion}
              {item.description ? ` — ${item.description}` : ""}
            </li>
          ))}
        </ul>
      </div>
      <button type="button" className={buttonPrimary} disabled={busy} onClick={onRestart}>
        {busy ? "Restarting…" : "Try again"}
      </button>
    </section>
  );
}

export function SimulationView({
  block,
  courseId,
  lessonId,
  preview,
  onResult,
}: Props) {
  const [mode, setMode] = useState<Mode>(preview ? "local" : "loading");
  const [view, setView] = useState<SimulationPublicView | null>(null);
  const [local, setLocal] = useState<{
    state: SimulationState;
    history: SimulationEvent[];
  } | null>(null);
  const [feedback, setFeedback] = useState<LearningFeedback | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [started, setStarted] = useState(!!preview);
  const reported = useRef(false);
  const onResultRef = useRef(onResult);
  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  const reportCompletion = useCallback((next: SimulationPublicView) => {
    if (next.status !== "completed" || reported.current) return;
    reported.current = true;
    onResultRef.current({ done: true });
  }, []);

  const resetLocal = useCallback(() => {
    const config = engineConfig(block);
    if (!config) {
      setError("This simulation can only run on the server.");
      return;
    }
    const state = startSimulation(config);
    setLocal({ state, history: [] });
    setView(simulationView(config, state, []));
    setFeedback(null);
    setError("");
    setStarted(true);
    reported.current = false;
  }, [block]);

  const configKey = JSON.stringify(block.config);
  useEffect(() => {
    if (preview) {
      const config = engineConfig(block);
      if (!config) {
        setMode("server");
        setError("This preview is missing the simulation rules.");
        return;
      }
      const state = startSimulation(config);
      setLocal({ state, history: [] });
      setView(simulationView(config, state, []));
      setStarted(true);
      return;
    }
    let active = true;
    const query = new URLSearchParams({
      courseId,
      lessonId,
      activityId: block.id,
    });
    fetch(`/api/simulations?${query}`)
      .then(async (response) => {
        if (!active) return;
        if (
          response.status === 401 ||
          (!isDatabaseCourseId(courseId) && !response.ok)
        ) {
          if (!engineConfig(block)) {
            setMode("server");
            throw new Error("Sign in to play this simulation.");
          }
          // Static catalogue courses still work as local practice when there is
          // no account or no record storage. Nothing is written to a gradebook.
          setMode("local");
          setStarted(false);
          return;
        }
        const data = await response.json();
        if (!response.ok) {
          setMode("server");
          throw new Error(data.error ?? "Could not load this simulation.");
        }
        setMode("server");
        if (data.session) {
          setView(data.session as SimulationPublicView);
          setFeedback((data.feedback as LearningFeedback | undefined) ?? null);
          setStarted(true);
          reportCompletion(data.session as SimulationPublicView);
        }
      })
      .catch((cause) => {
        if (!active) return;
        setMode((current) => (current === "loading" ? "server" : current));
        setStarted(false);
        setError((cause as Error).message);
      });
    return () => {
      active = false;
    };
  }, [block, block.id, configKey, courseId, lessonId, preview, reportCompletion]);

  async function beginLocal() {
    resetLocal();
  }

  async function start() {
    if (mode === "local") {
      resetLocal();
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/simulations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          lessonId,
          activityId: block.id,
          action: "start",
        }),
      });
      if (response.status === 401 || response.status === 503) {
        if (!engineConfig(block)) {
          throw new Error("Sign in to play this simulation.");
        }
        setMode("local");
        await beginLocal();
        return;
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setView(data.session as SimulationPublicView);
      setFeedback((data.feedback as LearningFeedback | undefined) ?? null);
      setStarted(true);
      reportCompletion(data.session as SimulationPublicView);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function chooseLocal(choiceId: string) {
    setError("");
    const config = engineConfig(block);
    if (!config) {
      setError("This simulation can only run on the server.");
      return;
    }
    try {
      const base =
        local ?? {
          state: startSimulation(config),
          history: [] as SimulationEvent[],
        };
      const result = applySimulationAction(config, base.state, choiceId);
      const history = [...base.history, result.event];
      const next = simulationView(config, result.state, history);
      setLocal({ state: result.state, history });
      setView(next);
      reportCompletion(next);
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  async function choose(choiceId: string) {
    if (mode === "local") {
      chooseLocal(choiceId);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/simulations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          lessonId,
          activityId: block.id,
          action: "choose",
          choiceId,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setView(data.session as SimulationPublicView);
      setFeedback((data.feedback as LearningFeedback | undefined) ?? null);
      reportCompletion(data.session as SimulationPublicView);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function restart() {
    reported.current = false;
    setFeedback(null);
    setError("");
    if (mode === "local") {
      resetLocal();
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/simulations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          lessonId,
          activityId: block.id,
          action: "restart",
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setView(data.session as SimulationPublicView);
      setStarted(true);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const scenario = view?.scenario ?? block.config.scenario;

  const intro = (
    <section className="space-y-4 rounded-2xl border border-stone-200 bg-white p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
          {preview ? "Teacher preview" : "Interactive simulation"}
        </p>
        <h3 className="text-xl font-semibold text-stone-900">{block.config.title}</h3>
      </div>
      <Markdown>{scenario.description}</Markdown>
      <div className="rounded-xl bg-stone-50 p-4">
        <h4 className="font-medium text-stone-800">The situation</h4>
        <p className="mt-1 whitespace-pre-wrap text-stone-700">{scenario.initialSituation}</p>
      </div>
      <div>
        <h4 className="font-medium text-stone-800">Your role</h4>
        <p className="text-stone-700">{scenario.participantRole}</p>
        {scenario.persona && (
          <p className="mt-1 text-sm text-indigo-700">You are dealing with: {scenario.persona}</p>
        )}
      </div>
      <div>
        <h4 className="font-medium text-stone-800">Objectives</h4>
        <ul className="mt-1 list-inside list-disc text-sm text-stone-700">
          {scenario.objectives.map((objective) => (
            <li key={objective}>{objective}</li>
          ))}
        </ul>
      </div>
      <p className="text-sm text-stone-500">
        Each decision changes the situation. There are {block.config.completion.maxSteps} steps at
        most.
        {mode === "local"
          ? " This practice run stays in this browser tab and is not added to your progress."
          : " Your progress is saved after every choice, so you can resume after a refresh."}
      </p>
      {preview && (
        <p className="text-sm text-stone-500">
          Preview runs in this browser only. Nothing is written to student records.
        </p>
      )}
      <button type="button" className={buttonPrimary} disabled={busy} onClick={() => void start()}>
        {busy ? "Starting…" : "Begin simulation"}
      </button>
    </section>
  );

  return (
    <div className="space-y-4">
      {mode === "loading" && (
        <p className="rounded-2xl border border-stone-200 bg-white p-6 text-stone-600">
          Loading your simulation…
        </p>
      )}
      {error && (
        <div role="alert" className="space-y-2 rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800">
          <p>{error}</p>
          {(started || mode === "server") && (
            <button type="button" className="font-medium underline" disabled={busy} onClick={() => void restart()}>
              Restart from the beginning
            </button>
          )}
        </div>
      )}
      {!started && mode !== "loading" ? intro : null}
      {started && view && (
        <>
          <section className="space-y-3 rounded-2xl border border-stone-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
                  {view.title}
                </p>
                <h3 className="text-xl font-semibold text-stone-900">{view.stage.title}</h3>
              </div>
              <span className="rounded-full bg-stone-100 px-3 py-1 text-sm text-stone-600">
                Step {view.step} of {view.maxSteps}
              </span>
            </div>
            <p className="whitespace-pre-wrap text-stone-700">{view.stage.narrative}</p>
            <details className="text-sm text-stone-600">
              <summary className="cursor-pointer font-medium">Scenario and role</summary>
              <div className="mt-2 space-y-2">
                <Markdown>{view.scenario.description}</Markdown>
                <p>
                  <strong>Your role:</strong> {view.scenario.participantRole}
                </p>
                <p>
                  <strong>Objectives:</strong> {view.scenario.objectives.join(" · ")}
                </p>
              </div>
            </details>
          </section>

          <VariablePanel view={view} />

          {view.status === "active" && (
            <section className="space-y-3 rounded-2xl border border-stone-200 bg-white p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
                What do you do?
              </h3>
              <div className="grid gap-3">
                {view.actions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    disabled={busy}
                    onClick={() => void choose(action.id)}
                    className="rounded-xl border border-stone-300 p-4 text-left transition hover:border-indigo-500 hover:bg-indigo-50 disabled:cursor-wait disabled:opacity-60"
                  >
                    <span className="font-medium text-stone-900">{action.label}</span>
                    {action.description && (
                      <span className="mt-1 block text-sm text-stone-600">{action.description}</span>
                    )}
                  </button>
                ))}
                {!view.actions.length && (
                  <p className="text-stone-600">
                    No action is available here. Restart the simulation to make a different choice.
                  </p>
                )}
              </div>
            </section>
          )}

          {view.history.length > 0 && (
            <section aria-live="polite" className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-indigo-700">
                Last decision
              </h3>
              <p className="mt-1 font-medium text-stone-900">
                {view.history[view.history.length - 1].actionLabel}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-stone-700">
                {view.history[view.history.length - 1].feedback}
              </p>
              {!!eventChanges(view.history[view.history.length - 1]).length && (
                <ul className="mt-2 flex flex-wrap gap-2 text-xs text-indigo-800">
                  {eventChanges(view.history[view.history.length - 1]).map((change, index) => (
                    <li key={index} className="rounded-full bg-white px-2 py-1">
                      {change}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <HistoryPanel
            events={view.history.slice(0, -1)}
            title={`Earlier decisions (${Math.max(0, view.history.length - 1)})`}
          />

          <CompletionPanel
            view={view}
            feedback={feedback}
            busy={busy}
            onRestart={() => void restart()}
          />

          {view.status === "active" && view.step > 0 && (
            <button
              type="button"
              disabled={busy}
              className="text-sm text-stone-500 underline"
              onClick={() => void restart()}
            >
              Restart this simulation
            </button>
          )}
        </>
      )}
    </div>
  );
}
