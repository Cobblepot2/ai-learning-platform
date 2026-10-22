"use client";
import {
  activityDefinitions,
  validateActivity,
  type LearningActivity,
} from "@/lib/learning/registry";

/** Editors are driven by each registration's initial config; specialised editors
 * can replace this one without changing CourseStudio. */
export function ActivityEditor({
  activity,
  onChange,
}: {
  activity: LearningActivity;
  onChange: (a: LearningActivity) => void;
}) {
  function update(key: string, value: unknown) {
    onChange({
      ...activity,
      config: { ...activity.config, [key]: value },
    } as LearningActivity);
  }
  const checked = validateActivity(activity);
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
              onChange={(e) => update(key, e.target.value)}
            >
              {["reflection", "writing", "scenario", "roleplay"].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          ) : typeof value === "number" ? (
            <input
              type="number"
              className="mt-1 block w-full rounded border p-2"
              value={value}
              onChange={(e) => update(key, Number(e.target.value))}
            />
          ) : (
            <textarea
              className="mt-1 min-h-24 w-full rounded border p-2 font-normal"
              value={Array.isArray(value) ? value.join("\n") : String(value)}
              onChange={(e) =>
                update(
                  key,
                  Array.isArray(value)
                    ? e.target.value.split("\n")
                    : e.target.value,
                )
              }
            />
          )}
          {Array.isArray(value) && (
            <span className="text-xs font-normal text-stone-500">
              One item per line
            </span>
          )}
        </label>
      ))}
      {!checked.success && (
        <p role="alert" className="text-sm text-red-700">
          {checked.error.message}
        </p>
      )}
    </div>
  );
}
