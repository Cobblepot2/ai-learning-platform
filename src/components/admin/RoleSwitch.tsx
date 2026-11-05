"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const ROLES = [
  ["student", "Student"],
  ["instructor", "Instructor"],
] as const;

/** Makes an account an instructor, or a student again. */
export function RoleSwitch({ userId, role }: { userId: string; role: string }) {
  const router = useRouter();
  const [current, setCurrent] = useState(role);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function change(next: string) {
    if (next === current) return;
    setBusy(true);
    setError("");
    const res = await fetch(`/api/admin/users/${userId}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: next }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Could not change the role.");
      return;
    }
    setCurrent(next);
    router.refresh();
  }

  return (
    <div>
      <div role="radiogroup" aria-label="Role" className="inline-flex rounded-full border border-white/15 p-0.5">
        {ROLES.map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={current === value}
            disabled={busy}
            onClick={() => void change(value)}
            className={`rounded-full px-3 py-1 text-xs ${current === value ? "bg-white text-black" : "text-white/65 hover:text-white"} disabled:opacity-60`}
          >
            {label}
          </button>
        ))}
      </div>
      {error && <p className="mt-1 text-xs text-rose-200">{error}</p>}
    </div>
  );
}
