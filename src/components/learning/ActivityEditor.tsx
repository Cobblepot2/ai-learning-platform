"use client";
import {
  activityDefinitions,
  validateActivity,
  type ActivityType,
  type LearningActivity,
} from "@/lib/learning/registry";

function FieldEditor({
  activity,
  onChange,
}: {
  activity: LearningActivity;
  onChange: (activity: LearningActivity) => void;
}) {
  function update(key: string, value: unknown) {
    onChange({
      ...activity,
      config: { ...activity.config, [key]: value },
    } as LearningActivity);
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-stone-500">
        {activityDefinitions[activity.activityType].description}
      </p>
      {Object.entries(activity.config).map(([key, value]) => (
        <label key={key} className="block text-sm font-medium capitalize">
          {key === "answer" ? "Correct option index (0 = first)" : key}
          {key === "mode" ? (
            <select
              className="mt-1 block w-full rounded border p-2"
              value={String(value)}
              onChange={(event) => update(key, event.target.value)}
            >
              {["reflection", "writing", "scenario", "roleplay"].map((mode) => (
                <option key={mode}>{mode}</option>
              ))}
            </select>
          ) : typeof value === "number" ? (
            <input
              type="number"
              className="mt-1 block w-full rounded border p-2"
              value={value}
              onChange={(event) => update(key, Number(event.target.value))}
            />
          ) : (
            <textarea
              className="mt-1 min-h-24 w-full rounded border p-2 font-normal"
              value={Array.isArray(value) ? value.join("\n") : String(value)}
              onChange={(event) =>
                update(
                  key,
                  Array.isArray(value)
                    ? event.target.value.split("\n")
                    : event.target.value,
                )
              }
            />
          )}
          {Array.isArray(value) && (
            <span className="text-xs font-normal text-stone-500">One item per line</span>
          )}
        </label>
      ))}
    </div>
  );
}

function QuizEditor({
  activity,
  onChange,
}: {
  activity: Extract<LearningActivity, { activityType: "quiz" }>;
  onChange: (activity: LearningActivity) => void;
}) {
  const questions = activity.config.questions;
  function setQuestions(next: typeof questions) {
    onChange({ ...activity, config: { ...activity.config, questions: next } });
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-stone-500">{activityDefinitions.quiz.description}</p>
      <label className="block text-sm font-medium">
        Title
        <input
          className="mt-1 w-full rounded border p-2"
          value={activity.config.title}
          onChange={(event) =>
            onChange({
              ...activity,
              config: { ...activity.config, title: event.target.value },
            })
          }
        />
      </label>
      {questions.map((question, index) => (
        <fieldset key={index} className="space-y-2 rounded border bg-white p-3">
          <legend className="px-1 text-sm font-semibold">Question {index + 1}</legend>
          <textarea
            aria-label={`Question ${index + 1}`}
            className="w-full rounded border p-2"
            value={question.question}
            onChange={(event) =>
              setQuestions(
                questions.map((item, itemIndex) =>
                  itemIndex === index ? { ...item, question: event.target.value } : item,
                ),
              )
            }
          />
          <textarea
            aria-label={`Options for question ${index + 1}`}
            className="w-full rounded border p-2"
            value={question.options.join("\n")}
            onChange={(event) =>
              setQuestions(
                questions.map((item, itemIndex) =>
                  itemIndex === index
                    ? {
                        ...item,
                        options: event.target.value.split("\n"),
                      }
                    : item,
                ),
              )
            }
          />
          <p className="text-xs text-stone-500">One option per line</p>
          <label className="block text-sm">
            Correct option index (0 = first)
            <input
              type="number"
              className="mt-1 w-full rounded border p-2"
              value={question.answer}
              onChange={(event) =>
                setQuestions(
                  questions.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, answer: Number(event.target.value) } : item,
                  ),
                )
              }
            />
          </label>
          <textarea
            aria-label={`Explanation for question ${index + 1}`}
            className="w-full rounded border p-2"
            value={question.explanation}
            onChange={(event) =>
              setQuestions(
                questions.map((item, itemIndex) =>
                  itemIndex === index ? { ...item, explanation: event.target.value } : item,
                ),
              )
            }
          />
          {questions.length > 1 && (
            <button
              type="button"
              className="text-sm text-red-700"
              onClick={() => setQuestions(questions.filter((_, itemIndex) => itemIndex !== index))}
            >
              Remove question
            </button>
          )}
        </fieldset>
      ))}
      {questions.length < 8 && (
        <button
          type="button"
          className="text-sm text-indigo-700"
          onClick={() =>
            setQuestions([
              ...questions,
              {
                question: "New question",
                options: ["Option A", "Option B"],
                answer: 0,
                explanation: "Explain the reasoning.",
              },
            ])
          }
        >
          + Question
        </button>
      )}
    </div>
  );
}

function CodeReviewEditor({
  activity,
  onChange,
}: {
  activity: Extract<LearningActivity, { activityType: "code-review" }>;
  onChange: (activity: LearningActivity) => void;
}) {
  function update(patch: Partial<typeof activity.config>) {
    onChange({ ...activity, config: { ...activity.config, ...patch } });
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-stone-500">
        {activityDefinitions["code-review"].description}
      </p>
      <label className="block text-sm font-medium">
        Context
        <textarea
          className="mt-1 min-h-20 w-full rounded border p-2 font-normal"
          value={activity.config.context}
          onChange={(event) => update({ context: event.target.value })}
        />
      </label>
      <label className="block text-sm font-medium">
        Language
        <input
          className="mt-1 w-full rounded border p-2 font-normal"
          value={activity.config.language}
          onChange={(event) => update({ language: event.target.value })}
        />
      </label>
      <label className="block text-sm font-medium">
        Code sample (line numbers start at 1)
        <textarea
          className="mt-1 min-h-48 w-full rounded border p-2 font-mono text-xs font-normal"
          value={activity.config.code}
          onChange={(event) => update({ code: event.target.value })}
        />
      </label>
      <label className="block text-sm font-medium">
        Bug line numbers (comma separated)
        <input
          className="mt-1 w-full rounded border p-2 font-normal"
          value={activity.config.bugLines.join(", ")}
          onChange={(event) =>
            update({
              bugLines: event.target.value
                .split(/[\s,]+/)
                .filter(Boolean)
                .map(Number)
                .filter((line) => Number.isInteger(line) && line > 0),
            })
          }
        />
      </label>
      <label className="block text-sm font-medium">
        Explanation
        <textarea
          className="mt-1 min-h-24 w-full rounded border p-2 font-normal"
          value={activity.config.explanation}
          onChange={(event) => update({ explanation: event.target.value })}
        />
      </label>
    </div>
  );
}

const editors: {
  [K in ActivityType]: (props: {
    activity: Extract<LearningActivity, { activityType: K }>;
    onChange: (activity: LearningActivity) => void;
  }) => React.ReactNode;
} = {
  reading: (props) => <FieldEditor {...props} />,
  choice: (props) => <FieldEditor {...props} />,
  ordering: (props) => <FieldEditor {...props} />,
  response: (props) => <FieldEditor {...props} />,
  conversation: (props) => <FieldEditor {...props} />,
  quiz: (props) => <QuizEditor {...props} />,
  "code-review": (props) => <CodeReviewEditor {...props} />,
};

/** Editors are registered per activity type. CourseStudio does not branch on the type. */
export function ActivityEditor({
  activity,
  onChange,
}: {
  activity: LearningActivity;
  onChange: (activity: LearningActivity) => void;
}) {
  const checked = validateActivity(activity);
  const Editor = editors[activity.activityType] as (props: {
    activity: LearningActivity;
    onChange: (activity: LearningActivity) => void;
  }) => React.ReactNode;
  return (
    <div className="space-y-3">
      <Editor activity={activity} onChange={onChange} />
      {!checked.success && (
        <p role="alert" className="text-sm text-red-700">
          {checked.error.message}
        </p>
      )}
    </div>
  );
}
