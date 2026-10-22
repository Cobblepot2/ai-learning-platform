"use client";
import { Markdown } from "@/components/Markdown";
import {
  activityDefinitions,
  validateActivity,
  type LearningActivity,
} from "@/lib/learning/registry";

function lines(activity: LearningActivity): { label: string; value: string; markdown?: boolean }[] {
  switch (activity.activityType) {
    case "reading":
      return [{ label: "Reading", value: activity.config.markdown, markdown: true }];
    case "choice":
      return [
        { label: "Question", value: activity.config.question },
        {
          label: "Options",
          value: activity.config.options
            .map((option, index) =>
              `${index === activity.config.answer ? "✓ " : ""}${index + 1}. ${option}`,
            )
            .join("\n"),
        },
        { label: "Explanation", value: activity.config.explanation },
      ];
    case "quiz":
      return [
        { label: "Title", value: activity.config.title },
        ...activity.config.questions.map((question, index) => ({
          label: `Question ${index + 1}`,
          value: [
            question.question,
            ...question.options.map(
              (option, optionIndex) =>
                `${optionIndex === question.answer ? "✓ " : ""}${optionIndex + 1}. ${option}`,
            ),
            `Why: ${question.explanation}`,
          ].join("\n"),
        })),
      ];
    case "ordering":
      return [
        { label: "Prompt", value: activity.config.prompt },
        {
          label: "Correct order",
          value: activity.config.items.map((item, index) => `${index + 1}. ${item}`).join("\n"),
        },
        { label: "Explanation", value: activity.config.explanation },
      ];
    case "code-review":
      return [
        { label: "Context", value: activity.config.context, markdown: true },
        { label: "Language", value: activity.config.language },
        { label: "Code", value: activity.config.code },
        {
          label: "Bug lines",
          value: activity.config.bugLines.join(", "),
        },
        { label: "Explanation", value: activity.config.explanation },
      ];
    case "response":
      return [
        { label: "Title", value: activity.config.title },
        { label: "Mode", value: activity.config.mode },
        { label: "Task", value: activity.config.task },
        { label: "Context", value: activity.config.context, markdown: true },
        { label: "Persona", value: activity.config.persona || "—" },
        { label: "Rubric", value: activity.config.rubric.map((item) => `• ${item}`).join("\n") },
      ];
    case "conversation":
      return [
        { label: "Title", value: activity.config.title },
        { label: "Minimum turns", value: String(activity.config.minTurns) },
        { label: "Scenario", value: activity.config.scenario },
        { label: "Opening", value: activity.config.opening },
        { label: "Goals", value: activity.config.goals.map((item) => `• ${item}`).join("\n") },
        { label: "Rubric", value: activity.config.rubric.map((item) => `• ${item}`).join("\n") },
        { label: "Character instructions", value: activity.config.persona },
      ];
    default: {
      const unreachable: never = activity;
      return [{ label: "Activity", value: String(unreachable) }];
    }
  }
}

export function ActivitySummary({
  activity,
  title,
  compareTo,
}: {
  activity: unknown;
  title?: string;
  compareTo?: unknown;
}) {
  const parsed = validateActivity(activity);
  const previous = compareTo ? validateActivity(compareTo) : null;
  if (!parsed.success) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
        {title && <p className="font-semibold">{title}</p>}
        <p>Unsupported activity: {parsed.error.message}</p>
      </div>
    );
  }
  const block = parsed.data;
  const beforeLines =
    previous?.success && previous.data.activityType === block.activityType
      ? lines(previous.data)
      : [];
  return (
    <article className="space-y-2 rounded border bg-stone-50 p-3 text-sm">
      {title && <p className="font-semibold text-stone-800">{title}</p>}
      <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
        {activityDefinitions[block.activityType].label}
        {previous?.success && previous.data.activityType !== block.activityType
          ? ` · was ${activityDefinitions[previous.data.activityType].label}`
          : ""}
      </p>
      {lines(block).map((line) => {
        const changed = beforeLines.some(
          (earlier) => earlier.label === line.label && earlier.value !== line.value,
        );
        return (
          <div key={line.label} className={changed ? "rounded bg-amber-50 p-2" : undefined}>
            <p className="font-medium text-stone-700">{line.label}</p>
            {line.markdown ? (
              <div className="max-h-60 overflow-auto">
                <Markdown>{line.value}</Markdown>
              </div>
            ) : (
              <p className="whitespace-pre-wrap text-stone-800">{line.value}</p>
            )}
          </div>
        );
      })}
    </article>
  );
}
