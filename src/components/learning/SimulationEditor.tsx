"use client";

import {
  SIMULATION_LIMITS,
  simulationProblems,
  type SimulationAction,
  type SimulationConfig,
  type SimulationEffect,
  type SimulationStage,
  type SimulationVariable,
  type SimulationOutcome,
} from "@/lib/learning/simulation/schema";
import type { LearningActivity } from "@/lib/learning/registry";

type Activity = Extract<LearningActivity, { activityType: "simulation" }>;
type Comparison = Extract<
  NonNullable<SimulationAction["availableWhen"]>,
  { kind: "compare" }
>;
type Condition = NonNullable<SimulationAction["availableWhen"]>;
type Rule = SimulationConfig["completion"]["rules"][number];

function uniqueId(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  let index = 2;
  while (used.has(`${base}-${index}`)) index += 1;
  return `${base}-${index}`;
}

function defaultValue(variable: SimulationVariable): number | boolean | string {
  if (variable.type === "number") return variable.initial;
  if (variable.type === "boolean") return true;
  return variable.options[0] ?? variable.initial;
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-medium text-stone-700">
      {label}
      {children}
      {hint && <span className="mt-1 block text-xs font-normal text-stone-500">{hint}</span>}
    </label>
  );
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <Field label={label}>
      <input
        className="mt-1 w-full rounded border p-2 font-normal"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

function TextArea({
  label,
  value,
  onChange,
  hint,
  mono,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  mono?: boolean;
}) {
  return (
    <Field label={label} hint={hint}>
      <textarea
        className={`mt-1 min-h-20 w-full rounded border p-2 font-normal ${mono ? "font-mono text-xs" : ""}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

function ValueInput({
  variable,
  value,
  onChange,
}: {
  variable: SimulationVariable;
  value: Comparison["value"];
  onChange: (value: Comparison["value"]) => void;
}) {
  if (variable.type === "number") {
    return (
      <input
        type="number"
        step="any"
        aria-label={`${variable.label} value`}
        className="w-full rounded border p-2 text-sm"
        value={typeof value === "number" ? value : variable.initial}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    );
  }
  if (variable.type === "boolean") {
    return (
      <select
        aria-label={`${variable.label} value`}
        className="w-full rounded border p-2 text-sm"
        value={value === true ? "yes" : "no"}
        onChange={(event) => onChange(event.target.value === "yes")}
      >
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    );
  }
  return (
    <select
      aria-label={`${variable.label} value`}
      className="w-full rounded border p-2 text-sm"
      value={typeof value === "string" ? value : variable.initial}
      onChange={(event) => onChange(event.target.value)}
    >
      {!variable.options.includes(String(value)) && typeof value === "string" && (
        <option value={String(value)}>{String(value)} (missing option)</option>
      )}
      {variable.options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function ComparisonFields({
  comparison,
  variables,
  onChange,
}: {
  comparison: Comparison;
  variables: SimulationVariable[];
  onChange: (comparison: Comparison) => void;
}) {
  const variable =
    variables.find((item) => item.id === comparison.variable) ?? variables[0];
  if (!variable) return <p className="text-sm text-red-700">Add a state variable first.</p>;
  const numeric = variable.type === "number";
  return (
    <div className="grid gap-2 sm:grid-cols-[1.2fr_0.8fr_1fr]">
      <select
        aria-label="State variable"
        className="rounded border p-2 text-sm"
        value={variable.id}
        onChange={(event) => {
          const next =
            variables.find((item) => item.id === event.target.value) ?? variable;
          onChange({
            kind: "compare",
            variable: next.id,
            op: next.type === "number" ? comparison.op : "eq",
            value: defaultValue(next),
          });
        }}
      >
        {variables.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
      <select
        aria-label="Comparison"
        className="rounded border p-2 text-sm"
        value={comparison.op}
        onChange={(event) =>
          onChange({ ...comparison, op: event.target.value as Comparison["op"] })
        }
      >
        <option value="eq">is equal to</option>
        <option value="neq">is not equal to</option>
        {numeric && <option value="gt">is greater than</option>}
        {numeric && <option value="gte">is at least</option>}
        {numeric && <option value="lt">is less than</option>}
        {numeric && <option value="lte">is at most</option>}
      </select>
      <ValueInput
        variable={variable}
        value={comparison.value}
        onChange={(value) => onChange({ ...comparison, value })}
      />
    </div>
  );
}

/** One-level condition builder: always, a single comparison, or one and/or group. */
function ConditionEditor({
  condition,
  variables,
  onChange,
  label,
}: {
  condition: Condition | undefined;
  variables: SimulationVariable[];
  onChange: (condition: Condition | undefined) => void;
  label: string;
}) {
  const kind = !condition ? "always" : condition.kind;
  const first = variables[0];
  function switchKind(next: "always" | "compare" | "group") {
    if (next === "always") return onChange(undefined);
    if (!first) return;
    const base: Comparison = {
      kind: "compare",
      variable: first.id,
      op: "eq",
      value: defaultValue(first),
    };
    if (next === "compare") return onChange(base);
    onChange({
      kind: "group",
      op: "and",
      conditions: [
        base,
        { ...base, variable: variables[1]?.id ?? base.variable, value: defaultValue(variables[1] ?? first) },
      ],
    });
  }
  return (
    <div className="space-y-2 rounded-xl bg-stone-50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-stone-700">{label}</span>
        <select
          aria-label={label}
          className="rounded border p-1.5 text-sm"
          value={kind}
          onChange={(event) =>
            switchKind(event.target.value as "always" | "compare" | "group")
          }
        >
          <option value="always">Always available</option>
          <option value="compare">One condition</option>
          <option value="group">All / any conditions</option>
        </select>
      </div>
      {condition?.kind === "compare" && (
        <ComparisonFields
          comparison={condition}
          variables={variables}
          onChange={onChange}
        />
      )}
      {condition?.kind === "group" && (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-stone-600">
            Match
            <select
              className="rounded border p-1.5"
              value={condition.op}
              onChange={(event) =>
                onChange({
                  ...condition,
                  op: event.target.value as "and" | "or",
                })
              }
            >
              <option value="and">all conditions</option>
              <option value="or">any condition</option>
            </select>
          </label>
          {condition.conditions.map((comparison, index) => (
            <div key={index} className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex-1">
                <ComparisonFields
                  comparison={comparison}
                  variables={variables}
                  onChange={(next) =>
                    onChange({
                      ...condition,
                      conditions: condition.conditions.map((item, itemIndex) =>
                        itemIndex === index ? next : item,
                      ),
                    })
                  }
                />
              </div>
              {condition.conditions.length > 2 && (
                <button
                  type="button"
                  className="self-end text-sm text-red-700 sm:self-auto"
                  onClick={() =>
                    onChange({
                      ...condition,
                      conditions: condition.conditions.filter(
                        (_, itemIndex) => itemIndex !== index,
                      ),
                    })
                  }
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          {condition.conditions.length < 6 && (
            <button
              type="button"
              className="text-sm text-indigo-700"
              onClick={() =>
                onChange({
                  ...condition,
                  conditions: [
                    ...condition.conditions,
                    {
                      kind: "compare",
                      variable: first.id,
                      op: "eq",
                      value: defaultValue(first),
                    },
                  ],
                })
              }
            >
              + Condition
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function EffectsEditor({
  action,
  variables,
  onChange,
}: {
  action: SimulationAction;
  variables: SimulationVariable[];
  onChange: (effects: SimulationEffect[]) => void;
}) {
  const first = variables.find((item) => item.type === "number") ?? variables[0];
  function setEffect(index: number, effect: SimulationEffect) {
    onChange(action.effects.map((item, itemIndex) => (itemIndex === index ? effect : item)));
  }
  return (
    <div className="space-y-2 rounded-xl bg-stone-50 p-3">
      <p className="text-sm font-medium text-stone-700">State changes</p>
      {action.effects.map((effect, index) => {
        const variable =
          variables.find((item) => item.id === effect.variable) ?? variables[0];
        return (
          <div key={index} className="grid gap-2 sm:grid-cols-[1.2fr_0.7fr_1fr_auto]">
            <select
              aria-label="Effect variable"
              className="rounded border p-2 text-sm"
              value={effect.variable}
              onChange={(event) => {
                const next =
                  variables.find((item) => item.id === event.target.value) ?? variable;
                const op = next.type === "number" ? effect.op : "set";
                setEffect(index, {
                  op,
                  variable: next.id,
                  value: op === "add" ? 1 : defaultValue(next),
                } as SimulationEffect);
              }}
            >
              {variables.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            <select
              aria-label="Effect operation"
              className="rounded border p-2 text-sm"
              value={effect.op}
              onChange={(event) => {
                const op = event.target.value as "add" | "set";
                setEffect(index, {
                  op,
                  variable: variable.id,
                  value: op === "add" ? 1 : defaultValue(variable),
                } as SimulationEffect);
              }}
            >
              <option value="set">set to</option>
              {variable.type === "number" && <option value="add">change by</option>}
            </select>
            {effect.op === "add" ? (
              <input
                type="number"
                step="any"
                aria-label="Effect amount"
                className="rounded border p-2 text-sm"
                value={effect.value}
                onChange={(event) =>
                  setEffect(index, { ...effect, value: Number(event.target.value) })
                }
              />
            ) : (
              <ValueInput
                variable={variable}
                value={effect.value}
                onChange={(value) =>
                  setEffect(index, { op: "set", variable: variable.id, value })
                }
              />
            )}
            <button
              type="button"
              aria-label="Remove state change"
              className="px-2 text-red-700"
              onClick={() =>
                onChange(action.effects.filter((_, itemIndex) => itemIndex !== index))
              }
            >
              ×
            </button>
          </div>
        );
      })}
      {action.effects.length < 6 && first && (
        <button
          type="button"
          className="text-sm text-indigo-700"
          onClick={() =>
            onChange([
              ...action.effects,
              first.type === "number"
                ? { op: "add", variable: first.id, value: 1 }
                : { op: "set", variable: first.id, value: defaultValue(first) },
            ])
          }
        >
          + State change
        </button>
      )}
      {!action.effects.length && (
        <p className="text-xs text-stone-500">
          This action must also move to another stage, otherwise it does nothing.
        </p>
      )}
    </div>
  );
}

function ActionEditor({
  action,
  stage,
  stages,
  variables,
  onChange,
  onRemove,
}: {
  action: SimulationAction;
  stage: SimulationStage;
  stages: SimulationStage[];
  variables: SimulationVariable[];
  onChange: (action: SimulationAction) => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-stone-300 bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="grid flex-1 gap-2 sm:grid-cols-2">
          <TextInput
            label="Action label"
            value={action.label}
            onChange={(label) => onChange({ ...action, label })}
          />
          <Field label="After choosing it">
            <select
              className="mt-1 w-full rounded border p-2 font-normal"
              value={action.nextStage ?? ""}
              onChange={(event) =>
                onChange({
                  ...action,
                  nextStage: event.target.value || undefined,
                })
              }
            >
              <option value="">Stay in this stage</option>
              {stages
                .filter((item) => item.id !== stage.id)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    Go to: {item.title}
                  </option>
                ))}
            </select>
          </Field>
        </div>
        <button type="button" className="text-sm text-red-700" onClick={onRemove}>
          Remove
        </button>
      </div>
      <TextInput
        label="Short description (optional)"
        value={action.description ?? ""}
        onChange={(description) =>
          onChange({ ...action, description: description || undefined })
        }
      />
      <TextArea
        label="Feedback after the choice"
        value={action.feedback}
        onChange={(feedback) => onChange({ ...action, feedback })}
        hint="Explain what changed and why. This is shown before the next stage."
      />
      <ConditionEditor
        label="Available when"
        condition={action.availableWhen}
        variables={variables}
        onChange={(availableWhen) => onChange({ ...action, availableWhen })}
      />
      <EffectsEditor
        action={action}
        variables={variables}
        onChange={(effects) => onChange({ ...action, effects })}
      />
      <p className="text-xs text-stone-400">ID: {action.id}</p>
    </div>
  );
}

function VariableEditor({
  variable,
  onChange,
  onRemove,
  canRemove,
}: {
  variable: SimulationVariable;
  onChange: (variable: SimulationVariable) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  function changeType(type: SimulationVariable["type"]) {
    const base = {
      id: variable.id,
      label: variable.label,
      description: variable.description,
      visible: variable.visible,
    };
    if (type === "number") {
      onChange({ ...base, type: "number", initial: 0, min: 0, max: 10 });
    } else if (type === "boolean") {
      onChange({ ...base, type: "boolean", initial: false });
    } else {
      onChange({
        ...base,
        type: "enum",
        initial: "option-a",
        options: ["option-a", "option-b"],
      });
    }
  }
  return (
    <div className="space-y-2 rounded-xl border border-stone-300 bg-white p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block text-sm font-medium text-stone-700">
          Label
          <input
            className="mt-1 w-full rounded border p-2 font-normal"
            value={variable.label}
            onChange={(event) => onChange({ ...variable, label: event.target.value })}
          />
        </label>
        <label className="block text-sm font-medium text-stone-700">
          Type
          <select
            className="mt-1 w-full rounded border p-2 font-normal"
            value={variable.type}
            onChange={(event) =>
              changeType(event.target.value as SimulationVariable["type"])
            }
          >
            <option value="number">Number</option>
            <option value="boolean">Yes / no</option>
            <option value="enum">One of several values</option>
          </select>
        </label>
      </div>
      {variable.type === "number" && (
        <>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="block text-sm font-medium text-stone-700">
              Starts at
              <input
                type="number"
                step="any"
                className="mt-1 w-full rounded border p-2 font-normal"
                value={variable.initial}
                onChange={(event) =>
                  onChange({ ...variable, initial: Number(event.target.value) })
                }
              />
            </label>
            <label className="block text-sm font-medium text-stone-700">
              Minimum
              <input
                type="number"
                step="any"
                className="mt-1 w-full rounded border p-2 font-normal"
                value={variable.min}
                onChange={(event) =>
                  onChange({ ...variable, min: Number(event.target.value) })
                }
              />
            </label>
            <label className="block text-sm font-medium text-stone-700">
              Maximum
              <input
                type="number"
                step="any"
                className="mt-1 w-full rounded border p-2 font-normal"
                value={variable.max}
                onChange={(event) =>
                  onChange({ ...variable, max: Number(event.target.value) })
                }
              />
            </label>
          </div>
          <label className="block text-sm font-medium text-stone-700">
            Unit (optional)
            <input
              className="mt-1 w-full rounded border p-2 font-normal"
              value={variable.unit ?? ""}
              placeholder="e.g. points, days, %"
              onChange={(event) =>
                onChange({ ...variable, unit: event.target.value || undefined })
              }
            />
          </label>
        </>
      )}
      {variable.type === "boolean" && (
        <label className="flex items-center gap-2 text-sm text-stone-700">
          <input
            type="checkbox"
            checked={variable.initial}
            onChange={(event) =>
              onChange({ ...variable, initial: event.target.checked })
            }
          />
          Starts as yes
        </label>
      )}
      {variable.type === "enum" && (
        <>
          <TextArea
            label="Options"
            hint="One option per line. The first option is the starting value."
            value={variable.options.join("\n")}
            onChange={(text) => {
              const options = text.split("\n").map((item) => item.trim()).filter(Boolean);
              onChange({
                ...variable,
                options,
                initial: options.includes(variable.initial)
                  ? variable.initial
                  : options[0] ?? "",
              });
            }}
          />
          <label className="block text-sm font-medium text-stone-700">
            Starts at
            <select
              className="mt-1 w-full rounded border p-2 font-normal"
              value={variable.initial}
              onChange={(event) =>
                onChange({ ...variable, initial: event.target.value })
              }
            >
              {variable.options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      <TextArea
        label="Description (optional)"
        value={variable.description ?? ""}
        onChange={(description) =>
          onChange({ ...variable, description: description || undefined })
        }
      />
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-stone-700">
          <input
            type="checkbox"
            checked={variable.visible !== false}
            onChange={(event) =>
              onChange({ ...variable, visible: event.target.checked })
            }
          />
          Show this value to students
        </label>
        <div className="flex items-center gap-3">
          <span className="text-xs text-stone-400">ID: {variable.id}</span>
          {canRemove && (
            <button type="button" className="text-sm text-red-700" onClick={onRemove}>
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StageEditor({
  stage,
  index,
  stages,
  variables,
  canRemove,
  onChange,
  onRemove,
}: {
  stage: SimulationStage;
  index: number;
  stages: SimulationStage[];
  variables: SimulationVariable[];
  canRemove: boolean;
  onChange: (stage: SimulationStage) => void;
  onRemove: () => void;
}) {
  function addAction() {
    const ids = stages.flatMap((item) => item.actions.map((action) => action.id));
    const first = variables[0];
    onChange({
      ...stage,
      actions: [
        ...stage.actions,
        {
          id: uniqueId("action", ids),
          label: "New action",
          feedback: "Explain what this decision changes.",
          effects: first
            ? [
                first.type === "number"
                  ? { op: "add", variable: first.id, value: 1 }
                  : { op: "set", variable: first.id, value: defaultValue(first) },
              ]
            : [],
        },
      ],
    });
  }
  return (
    <details open className="rounded-xl border border-stone-300 bg-stone-50 p-3">
      <summary className="cursor-pointer text-sm font-semibold text-stone-800">
        Stage {index + 1}: {stage.title}
      </summary>
      <div className="mt-3 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="grid flex-1 gap-2 sm:grid-cols-2">
            <TextInput
              label="Stage title"
              value={stage.title}
              onChange={(title) => onChange({ ...stage, title })}
            />
            <p className="self-end text-xs text-stone-400">ID: {stage.id}</p>
          </div>
          {canRemove && (
            <button type="button" className="text-sm text-red-700" onClick={onRemove}>
              Remove stage
            </button>
          )}
        </div>
        <TextArea
          label="Narrative"
          value={stage.narrative}
          onChange={(narrative) => onChange({ ...stage, narrative })}
          hint="What the learner sees at this point in the situation."
        />
        <label className="block text-sm font-medium text-stone-700">
          This stage is
          <select
            className="mt-1 w-full rounded border p-2 font-normal"
            value={stage.ending ? "ending" : "decision"}
            onChange={(event) => {
              if (event.target.value === "ending") {
                onChange({
                  ...stage,
                  actions: [],
                  ending: { outcome: "success", summary: "Describe how this run ended." },
                });
              } else {
                onChange({ ...stage, ending: undefined });
              }
            }}
          >
            <option value="decision">A decision point</option>
            <option value="ending">An ending (no further choices)</option>
          </select>
        </label>
        {stage.ending ? (
          <div className="space-y-2 rounded-xl bg-white p-3">
            <label className="block text-sm font-medium text-stone-700">
              Outcome
              <select
                className="mt-1 w-full rounded border p-2 font-normal"
                value={stage.ending.outcome}
                onChange={(event) =>
                  onChange({
                    ...stage,
                    ending: {
                      ...stage.ending!,
                      outcome: event.target.value as Exclude<SimulationOutcome, "incomplete">,
                    },
                  })
                }
              >
                <option value="success">Success</option>
                <option value="partial">Partial success</option>
                <option value="failure">Failure</option>
              </select>
            </label>
            <TextArea
              label="Ending summary"
              value={stage.ending.summary}
              onChange={(summary) =>
                onChange({ ...stage, ending: { ...stage.ending!, summary } })
              }
            />
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {stage.actions.map((action, actionIndex) => (
                <ActionEditor
                  key={action.id}
                  action={action}
                  stage={stage}
                  stages={stages}
                  variables={variables}
                  onChange={(next) =>
                    onChange({
                      ...stage,
                      actions: stage.actions.map((item, itemIndex) =>
                        itemIndex === actionIndex ? next : item,
                      ),
                    })
                  }
                  onRemove={() =>
                    onChange({
                      ...stage,
                      actions: stage.actions.filter(
                        (_, itemIndex) => itemIndex !== actionIndex,
                      ),
                    })
                  }
                />
              ))}
            </div>
            {stage.actions.length < SIMULATION_LIMITS.actionsPerStage && (
              <button type="button" className="text-sm text-indigo-700" onClick={addAction}>
                + Action
              </button>
            )}
            {!stage.actions.length && (
              <p className="text-sm text-red-700">
                Add at least one action, or turn this stage into an ending.
              </p>
            )}
          </>
        )}
      </div>
    </details>
  );
}

function SimulationEditor({
  activity,
  onChange,
}: {
  activity: Activity;
  onChange: (activity: LearningActivity) => void;
}) {
  const config = activity.config;
  function update(patch: Partial<SimulationConfig>) {
    onChange({ ...activity, config: { ...config, ...patch } });
  }
  const allVariableIds = config.variables.map((variable) => variable.id);
  const allStageIds = config.stages.map((stage) => stage.id);

  function addVariable() {
    if (config.variables.length >= SIMULATION_LIMITS.variables) return;
    update({
      variables: [
        ...config.variables,
        {
          id: uniqueId("state", allVariableIds),
          type: "number",
          label: "New state",
          initial: 0,
          min: 0,
          max: 10,
          visible: true,
        },
      ],
    });
  }

  function removeVariable(id: string) {
    if (config.variables.length <= 1) return;
    // Drop conditions that refer to the removed variable rather than leaving
    // dangling ids behind; the editor always stays schema-valid where possible.
    function strip(
      condition: Condition | undefined,
    ): Condition | undefined {
      if (!condition) return undefined;
      if (condition.kind === "compare") {
        return condition.variable === id ? undefined : condition;
      }
      const conditions = condition.conditions.filter(
        (comparison) => comparison.variable !== id,
      );
      if (!conditions.length) return undefined;
      if (conditions.length === 1) return conditions[0];
      return { ...condition, conditions };
    }
    update({
      variables: config.variables.filter((variable) => variable.id !== id),
      stages: config.stages.map((stage) => ({
        ...stage,
        actions: stage.actions.map((action) => ({
          ...action,
          availableWhen: strip(action.availableWhen),
          effects: action.effects.filter((effect) => effect.variable !== id),
        })),
      })),
      completion: {
        ...config.completion,
        rules: config.completion.rules
          .map((rule) => ({ ...rule, when: strip(rule.when) }))
          .filter((rule): rule is Rule => Boolean(rule.when)),
      },
    });
  }

  function removeStage(id: string) {
    if (config.stages.length <= 2) return;
    const stages = config.stages
      .filter((stage) => stage.id !== id)
      .map((stage) => ({
        ...stage,
        actions: stage.actions.map((action) =>
          action.nextStage === id ? { ...action, nextStage: undefined } : action,
        ),
      }));
    update({
      stages,
      startStage:
        config.startStage === id ? stages[0].id : config.startStage,
    });
  }

  function addStage(ending: boolean) {
    if (config.stages.length >= SIMULATION_LIMITS.stages) return;
    const id = uniqueId("stage", allStageIds);
    const first = config.variables[0];
    update({
      stages: [
        ...config.stages,
        ending
          ? {
              id,
              title: "New ending",
              narrative: "Describe what the learner sees at the end.",
              actions: [],
              ending: {
                outcome: "success",
                summary: "Describe why this outcome happened.",
              },
            }
          : {
              id,
              title: "New decision point",
              narrative: "Describe the new situation and the decision it requires.",
              actions: first
                ? [
                    {
                      id: uniqueId("action", config.stages.flatMap((stage) =>
                        stage.actions.map((action) => action.id),
                      )),
                      label: "New action",
                      feedback: "Explain what this decision changes.",
                      effects: [
                        first.type === "number"
                          ? { op: "add", variable: first.id, value: 1 }
                          : {
                              op: "set",
                              variable: first.id,
                              value: defaultValue(first),
                            },
                      ],
                    },
                  ]
                : [],
            },
      ],
    });
  }

  const problems = simulationProblems(config);

  return (
    <div className="space-y-6">
      <p className="text-sm text-stone-500">
        A declared, stateful scenario. Students choose actions; the server applies these
        rules. No code is generated or executed.
      </p>

      {!!problems.length && (
        <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-semibold">This activity is not playable yet:</p>
          <ul className="mt-1 list-inside list-disc">
            {problems.slice(0, 6).map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </div>
      )}

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
          Scenario
        </h3>
        <TextInput
          label="Title"
          value={config.title}
          onChange={(title) => update({ title })}
        />
        <TextArea
          label="Scenario description"
          value={config.scenario.description}
          onChange={(description) =>
            update({ scenario: { ...config.scenario, description } })
          }
        />
        <TextArea
          label="Initial situation"
          value={config.scenario.initialSituation}
          onChange={(initialSituation) =>
            update({ scenario: { ...config.scenario, initialSituation } })
          }
        />
        <TextInput
          label="Participant role"
          value={config.scenario.participantRole}
          onChange={(participantRole) =>
            update({ scenario: { ...config.scenario, participantRole } })
          }
        />
        <TextInput
          label="Other party / persona (optional)"
          value={config.scenario.persona ?? ""}
          onChange={(persona) =>
            update({ scenario: { ...config.scenario, persona: persona || undefined } })
          }
        />
        <TextArea
          label="Objectives"
          hint="One objective per line."
          value={config.scenario.objectives.join("\n")}
          onChange={(text) =>
            update({
              scenario: {
                ...config.scenario,
                objectives: text.split("\n").map((item) => item.trim()).filter(Boolean),
              },
            })
          }
        />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
            Start
          </h3>
          <label className="text-sm text-stone-600">
            Start stage{" "}
            <select
              className="rounded border p-1.5"
              value={config.startStage}
              onChange={(event) => update({ startStage: event.target.value })}
            >
              {config.stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.title}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
            State variables
          </h3>
          {config.variables.length < SIMULATION_LIMITS.variables && (
            <button type="button" className="text-sm text-indigo-700" onClick={addVariable}>
              + Variable
            </button>
          )}
        </div>
        {config.variables.map((variable) => (
          <VariableEditor
            key={variable.id}
            variable={variable}
            canRemove={config.variables.length > 1}
            onChange={(next) =>
              update({
                variables: config.variables.map((item) =>
                  item.id === variable.id ? next : item,
                ),
              })
            }
            onRemove={() => removeVariable(variable.id)}
          />
        ))}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
            Stages and choices
          </h3>
          {config.stages.length < SIMULATION_LIMITS.stages && (
            <div className="flex gap-3 text-sm">
              <button type="button" className="text-indigo-700" onClick={() => addStage(false)}>
                + Decision stage
              </button>
              <button type="button" className="text-indigo-700" onClick={() => addStage(true)}>
                + Ending
              </button>
            </div>
          )}
        </div>
        {config.stages.map((stage, index) => (
          <StageEditor
            key={stage.id}
            stage={stage}
            index={index}
            stages={config.stages}
            variables={config.variables}
            canRemove={config.stages.length > 2}
            onChange={(next) =>
              update({
                stages: config.stages.map((item) =>
                  item.id === stage.id ? next : item,
                ),
              })
            }
            onRemove={() => removeStage(stage.id)}
          />
        ))}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
          Completion
        </h3>
        <label className="block text-sm font-medium text-stone-700">
          Maximum steps
          <input
            type="number"
            min={3}
            max={SIMULATION_LIMITS.maxSteps}
            className="mt-1 w-full rounded border p-2 font-normal sm:w-40"
            value={config.completion.maxSteps}
            onChange={(event) =>
              update({
                completion: {
                  ...config.completion,
                  maxSteps: Number(event.target.value),
                },
              })
            }
          />
        </label>
        <TextArea
          label="Summary when the step limit is reached"
          value={config.completion.exhaustedSummary}
          onChange={(exhaustedSummary) =>
            update({ completion: { ...config.completion, exhaustedSummary } })
          }
        />
        {config.completion.rules.map((rule, index) => (
          <div key={index} className="space-y-2 rounded-xl border border-stone-300 bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">Ending rule {index + 1}</p>
              <button
                type="button"
                className="text-sm text-red-700"
                onClick={() =>
                  update({
                    completion: {
                      ...config.completion,
                      rules: config.completion.rules.filter(
                        (_, itemIndex) => itemIndex !== index,
                      ),
                    },
                  })
                }
              >
                Remove
              </button>
            </div>
            <label className="block text-sm font-medium text-stone-700">
              Outcome
              <select
                className="mt-1 w-full rounded border p-2 font-normal"
                value={rule.outcome}
                onChange={(event) =>
                  update({
                    completion: {
                      ...config.completion,
                      rules: config.completion.rules.map((item, itemIndex) =>
                        itemIndex === index
                          ? {
                              ...item,
                              outcome: event.target.value as Rule["outcome"],
                            }
                          : item,
                      ),
                    },
                  })
                }
              >
                <option value="success">Success</option>
                <option value="partial">Partial success</option>
                <option value="failure">Failure</option>
              </select>
            </label>
            <ConditionEditor
              label="Ends when"
              condition={rule.when}
              variables={config.variables}
              onChange={(when) =>
                update({
                  completion: {
                    ...config.completion,
                    rules: config.completion.rules.map((item, itemIndex) =>
                      itemIndex === index && when ? { ...item, when } : item,
                    ),
                  },
                })
              }
            />
            <TextArea
              label="Rule summary"
              value={rule.summary}
              onChange={(summary) =>
                update({
                  completion: {
                    ...config.completion,
                    rules: config.completion.rules.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, summary } : item,
                    ),
                  },
                })
              }
            />
          </div>
        ))}
        {config.completion.rules.length < SIMULATION_LIMITS.rules && config.variables[0] && (
          <button
            type="button"
            className="text-sm text-indigo-700"
            onClick={() =>
              update({
                completion: {
                  ...config.completion,
                  rules: [
                    ...config.completion.rules,
                    {
                      outcome: "failure",
                      when: {
                        kind: "compare",
                        variable: config.variables[0].id,
                        op: "lte",
                        value:
                          config.variables[0].type === "number"
                            ? config.variables[0].min
                            : defaultValue(config.variables[0]),
                      },
                      summary: "Describe why this ending happened.",
                    },
                  ],
                },
              })
            }
          >
            + Ending rule
          </button>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
          Rubric
        </h3>
        {config.rubric.map((item, index) => (
          <div key={item.id} className="grid gap-2 rounded-xl border border-stone-300 bg-white p-3 sm:grid-cols-[1fr_1fr_auto]">
            <TextInput
              label="Criterion"
              value={item.criterion}
              onChange={(criterion) =>
                update({
                  rubric: config.rubric.map((entry, itemIndex) =>
                    itemIndex === index ? { ...entry, criterion } : entry,
                  ),
                })
              }
            />
            <TextInput
              label="Description (optional)"
              value={item.description ?? ""}
              onChange={(description) =>
                update({
                  rubric: config.rubric.map((entry, itemIndex) =>
                    itemIndex === index
                      ? { ...entry, description: description || undefined }
                      : entry,
                  ),
                })
              }
            />
            {config.rubric.length > 1 && (
              <button
                type="button"
                className="self-end text-sm text-red-700"
                onClick={() =>
                  update({
                    rubric: config.rubric.filter((_, itemIndex) => itemIndex !== index),
                  })
                }
              >
                Remove
              </button>
            )}
          </div>
        ))}
        {config.rubric.length < SIMULATION_LIMITS.rubric && (
          <button
            type="button"
            className="text-sm text-indigo-700"
            onClick={() =>
              update({
                rubric: [
                  ...config.rubric,
                  {
                    id: uniqueId(
                      "criterion",
                      config.rubric.map((item) => item.id),
                    ),
                    criterion: "New criterion",
                  },
                ],
              })
            }
          >
            + Criterion
          </button>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
          Debrief by outcome
        </h3>
        {(["success", "partial", "failure", "incomplete"] as const).map((outcome) => (
          <TextArea
            key={outcome}
            label={outcome[0].toUpperCase() + outcome.slice(1)}
            value={config.debrief[outcome]}
            onChange={(text) =>
              update({ debrief: { ...config.debrief, [outcome]: text } })
            }
          />
        ))}
      </section>
    </div>
  );
}

export { SimulationEditor };
