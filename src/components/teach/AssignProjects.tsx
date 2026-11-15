"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AssignmentConflict, createAssignmentSaver, type AssignmentSaveStatus } from "@/lib/assignment-saver";

/** Show clicks immediately; serialize writes and retain newer clicks while saving. */
export function AssignProjects({ classId, projects, assigned, version }: { classId: string; projects: { id: string; title: string }[]; assigned: string[]; version: number }) {
  const router = useRouter();
  const [chosen, setChosen] = useState(assigned);
  const [status, setStatus] = useState<AssignmentSaveStatus>({ saving: false, saved: false, error: null, conflict: false });
  const latest = useRef(assigned);
  const active = useRef(true);
  const saver = useRef<ReturnType<typeof createAssignmentSaver> | null>(null);
  if (!saver.current) {
    saver.current = createAssignmentSaver(version, async (selection, expectedVersion) => {
      let res: Response;
      try {
        res = await fetch(`/api/classes/${classId}/projects`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ projects: selection, expectedVersion }) });
      } catch { throw new Error("Could not save. Your choices are kept. Please retry."); }
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) throw new AssignmentConflict(data.error ?? "Assignments changed. Reload the class.");
      if (!res.ok) throw new Error(data.error ?? "Could not save. Your choices are kept. Please retry.");
      if (!Number.isInteger(data.version)) throw new Error("Could not confirm the save. Reload the class to check it.");
      return data.version;
    }, (next) => { if (active.current) setStatus(next); }, () => { if (active.current) router.refresh(); });
  }
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => {
    if (saver.current!.sync(version)) {
      latest.current = assigned;
      setChosen(assigned);
    }
  }, [assigned, version]);

  function toggle(id: string) {
    const next = latest.current.includes(id) ? latest.current.filter((item) => item !== id) : [...latest.current, id];
    latest.current = next;
    setChosen(next);
    saver.current!.choose(next);
  }

  return (
    <div>
      <ul className="flex flex-wrap gap-2">
        {projects.map((project) => {
          const on = chosen.includes(project.id);
          return (
            <li key={project.id}>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                disabled={status.conflict}
                onClick={() => toggle(project.id)}
                className={`rounded-full border px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 ${on ? "border-cyan-300 bg-cyan-300/10 text-white" : "border-white/15 text-white/70 hover:border-white/40"}`}
              >
                {on ? "✓ " : ""}
                {project.title}
              </button>
            </li>
          );
        })}
      </ul>
      <p role="status" className="mt-3 text-sm text-white/70">{status.saving ? "Saving…" : status.saved ? "Saved" : ""}</p>
      {status.error && <div className="mt-3 text-sm text-rose-200"><p role="alert">{status.error}</p>{status.conflict && <p className="mt-2 text-white/70">The last save may have succeeded even if its response was lost. Reloading shows the saved assignments and discards unsaved choices in this tab.</p>}<button type="button" className="mt-2 rounded-full border border-white/30 px-4 py-2 text-white hover:bg-white/10" onClick={() => status.conflict ? window.location.reload() : saver.current!.retry()}>{status.conflict ? "Reload assignments" : "Retry save"}</button></div>}
    </div>
  );
}
