"use client";

export function PreferenceChoice<T extends string>({
  label,
  hint,
  name,
  options,
  value,
  onChange,
  columns = 1,
}: {
  label: string;
  hint?: string;
  name: string;
  options: Record<T, string>;
  value: T;
  onChange: (value: T) => void;
  columns?: 1 | 3;
}) {
  return (
    <fieldset>
      <legend className="font-medium text-stone-900">{label}</legend>
      {hint && <p className="mt-1 text-sm text-stone-500">{hint}</p>}
      <div
        className={`mt-2 grid gap-2 ${columns === 3 ? "sm:grid-cols-3" : ""}`}
      >
        {(Object.keys(options) as T[]).map((key) => (
          <label
            key={key}
            className="relative cursor-pointer rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700 transition hover:border-stone-300 has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50 has-[:checked]:text-indigo-900 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-indigo-200"
          >
            <input
              type="radio"
              name={name}
              value={key}
              checked={value === key}
              onChange={() => onChange(key)}
              className="sr-only"
            />
            {options[key]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
