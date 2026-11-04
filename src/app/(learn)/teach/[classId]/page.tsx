import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { glass } from "@/components/home/glass";
import { Reveal } from "@/components/home/Reveal";
import { AssignProjects } from "@/components/teach/AssignProjects";
import { RemoveStudent } from "@/components/teach/RemoveStudent";
import { assignableFor, classProgress, loadOwnClass, type RunSummary } from "@/lib/classes";
import type { ConceptResult } from "@/lib/projects/runtime";
import { instructor } from "@/lib/instructor";

export const metadata: Metadata = { title: "Class · DevPath" };

const OUTCOMES: Record<string, { label: string; className: string }> = {
  success: { label: "Success", className: "bg-emerald-400/15 text-emerald-200" },
  partial: { label: "Partial", className: "bg-amber-400/15 text-amber-100" },
  failure: { label: "Failed", className: "bg-rose-400/15 text-rose-200" },
  incomplete: { label: "Ran out of time", className: "bg-white/10 text-white/70" },
};

const CONCEPT: Record<ConceptResult["outcome"], { label: string; className: string }> = {
  prevented: { label: "Prevented", className: "text-emerald-200" },
  caught: { label: "Caught", className: "text-emerald-200" },
  shipped: { label: "Shipped", className: "text-rose-200" },
  "left-out": { label: "Left out", className: "text-amber-100" },
  "not-reached": { label: "Not reached", className: "text-white/50" },
};

const RATING: Record<string, string> = { strong: "explained well", mixed: "partly explained", weak: "not explained" };

function when(iso: string) {
  // Rendered on the server, whose clock is UTC on Vercel; the class is in Hong Kong.
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Hong_Kong" });
}

function Concepts({ run }: { run: Extract<RunSummary, { status: "active" | "completed" }> }) {
  if (!run.concepts.length) return null;
  return (
    <ul className="mt-2 space-y-1 text-sm">
      {run.concepts.map((concept) => {
        // Until the run ends, only what the brief or a send-back settled is final.
        const settled = run.status === "completed" || concept.outcome === "prevented" || concept.outcome === "caught";
        const shown = settled ? CONCEPT[concept.outcome] : { label: "Not decided yet", className: "text-white/50" };
        return (
          <li key={concept.name}>
            <span className="text-white/75">{concept.name}</span> · <span className={shown.className}>{shown.label}</span>
            {concept.note && <span className="text-white/50"> · teach-back {RATING[concept.note.rating]}</span>}
            {concept.note && <p className="mt-0.5 text-white/45">“{concept.note.text}”</p>}
          </li>
        );
      })}
    </ul>
  );
}

function Run({ run }: { run: RunSummary }) {
  if (run.status === "not-started") return <p className="text-sm text-white/45">Not started</p>;
  const outcome = run.outcome ? OUTCOMES[run.outcome] : null;
  return (
    <div>
      <p className="flex flex-wrap items-center gap-2 text-sm">
        {outcome ? (
          <span className={`rounded-full px-2.5 py-0.5 ${outcome.className}`}>{outcome.label}</span>
        ) : (
          <span className="rounded-full bg-cyan-400/15 px-2.5 py-0.5 text-cyan-200">In progress: {run.stage}</span>
        )}
        <span className="text-white/60">Trust {run.trust}/10 · {run.days} of 10 days</span>
        {run.track && <span className="text-white/45">{run.track === "engineering" ? "Tech lead" : "Product lead"}</span>}
        <span className="text-white/35">{when(run.updatedAt)}</span>
      </p>
      <Concepts run={run} />
    </div>
  );
}

export default async function ClassPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  const teacher = await instructor();
  if (!teacher) notFound();
  const owned = await loadOwnClass(teacher.db, teacher.user.id, classId);
  if (!owned) notFound();
  const [students, assignable] = await Promise.all([classProgress(teacher.user.id, owned.members, owned.projects), assignableFor(teacher.db)]);
  const titles = new Map(assignable.map((project) => [project.id, project.title]));

  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 pt-12 text-white lg:px-0 lg:pt-16">
      <Reveal>
        <Link href="/teach" className="text-sm text-white/50 hover:text-white">← Your classes</Link>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">{owned.name}</h1>
        <div className={`${glass} mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 p-6`}>
          <p className="font-mono text-3xl tracking-[0.3em]">{owned.join_code}</p>
          <p className="text-white/60">Students open Projects, choose “Join a class” and enter this code.</p>
        </div>
      </Reveal>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Assigned projects</h2>
        <p className="mt-1 text-sm text-white/55">
          Students see these under the class on their Projects page. Projects you <Link href="/teach/projects" className="underline hover:text-white">create or customise</Link> appear here too.
        </p>
        <div className="mt-4">
          <AssignProjects classId={owned.id} projects={assignable} assigned={owned.projects} />
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold">
          Students <span className="font-normal text-white/45">{students.length}</span>
        </h2>
        {owned.projects.length > 0 && students.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-white/60">
            {owned.projects.map((id) => {
              const runs = students.map((student) => student.runs[id]).filter(Boolean);
              const finished = runs.filter((run) => run.status === "completed").length;
              const started = runs.filter((run) => run.status !== "not-started").length;
              return (
                <li key={id}>
                  {titles.get(id)}: {started} started, {finished} finished
                </li>
              );
            })}
          </ul>
        )}
        {!students.length && <p className="mt-3 text-white/50">Nobody has joined yet. Share the code above.</p>}
        <ul className="mt-5 space-y-4">
          {students.map((student) => (
            <li key={student.id} className={`${glass} p-6`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <p className="text-lg font-semibold">{student.name}</p>
                  {student.email && <p className="text-sm text-white/45">{student.email}</p>}
                </div>
                <RemoveStudent classId={owned.id} studentId={student.id} name={student.name} />
              </div>
              {owned.projects.length ? (
                <ul className="mt-4 space-y-4">
                  {owned.projects.map((id) => (
                    <li key={id} className="border-t border-white/10 pt-3">
                      <p className="font-medium">{titles.get(id)}</p>
                      <div className="mt-1">{student.runs[id] && <Run run={student.runs[id]} />}</div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-white/45">Assign a project to see progress.</p>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
