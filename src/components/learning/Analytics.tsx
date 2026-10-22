"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { CourseRecord } from "@/lib/learning/model";
import {
  sameActivityContent,
  type LearningFeedback,
} from "@/lib/learning/registry";
import { buttonPrimary } from "@/components/blocks/BlockCard";
type Report = {
  course: CourseRecord;
  enrolments: { student_id: string }[];
  invitations: { email: string; course_id?: string }[];
  profiles: { id: string; display_name: string }[];
  progress: {
    user_id: string;
    lesson_id: string;
    completed_at: string | null;
  }[];
  attempts: {
    id: string;
    user_id: string;
    activity_id: string;
    response: string;
    score: number | null;
    feedback: LearningFeedback;
    created_at: string;
    course_revision: number;
    lesson_id: string;
    activity_snapshot: unknown;
  }[];
};
export function Analytics({ courseId }: { courseId: string }) {
  const [data, setData] = useState<Report | null>(null);
  const [emails, setEmails] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    const res = await fetch(`/api/enrolments?courseId=${courseId}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error);
    setData(json);
  }
  useEffect(() => {
    let active = true;
    fetch(`/api/enrolments?courseId=${courseId}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        if (active) setData(d);
      })
      .catch((e) => {
        if (active) setMessage(e.message);
      });
    return () => {
      active = false;
    };
  }, [courseId]);
  async function invite() {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/enrolments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          emails: emails.split(/[\s,;]+/).filter(Boolean),
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      setMessage(
        `${result.invited} invitations saved. Students sign in with these emails and select “Join invited courses” in My courses. No emails were sent.`,
      );
      setEmails("");
      await load();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(query: string) {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch(`/api/enrolments?courseId=${courseId}&${query}`, {
        method: "DELETE",
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      setMessage(
        query.startsWith("email=")
          ? "Invitation revoked. A student who already joined stays enrolled until you remove them."
          : "Student removed from the course. Their submitted attempts are kept.",
      );
      await load();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const participants =
    data?.enrolments.filter((e) =>
      data.attempts.some((a) => a.user_id === e.student_id),
    ).length ?? 0;
  return (
    <section className="space-y-4 rounded-2xl border bg-white p-6">
      <h2 className="text-xl font-semibold">Students & learning evidence</h2>
      <label className="block">
        Import email addresses (comma or newline separated)
        <textarea
          className="mt-2 w-full rounded border p-3"
          value={emails}
          onChange={(e) => setEmails(e.target.value)}
        />
      </label>
      <button
        className={buttonPrimary}
        disabled={busy || !emails.trim()}
        onClick={invite}
      >
        Save invitations
      </button>
      <button
        className="ml-3 underline"
        onClick={() => load().catch((e) => setMessage(e.message))}
      >
        Refresh results
      </button>
      {message && <p role="status">{message}</p>}
      {data && (
        <>
          <p>
            {data.enrolments.length} enrolled · {participants} participated in
            an activity · {data.invitations.length} pending invitations
          </p>
          <p className="text-sm text-stone-500">
            Completion is based on current lesson IDs. Quiz scores are per
            attempt; open responses have qualitative rubric feedback. Activity
            participation means a submitted response, not page views.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Lessons complete</th>
                  <th>Attempts</th>
                  <th>Quiz results</th>
                  <th>Roster</th>
                </tr>
              </thead>
              <tbody>
                {data.enrolments.map((e) => {
                  const completed = data.progress.filter(
                    (p) =>
                      p.user_id === e.student_id &&
                      p.completed_at &&
                      data.course.document.lessons.some(
                        (l) =>
                          l.id === p.lesson_id &&
                          l.blocks
                            .filter((b) => b.activityType !== "reading")
                            .every((b) =>
                              data.attempts.some(
                                (a) =>
                                  a.user_id === e.student_id &&
                                  a.activity_id === b.id &&
                                  sameActivityContent(a.activity_snapshot, b),
                              ),
                            ),
                      ),
                  ).length;
                  const attempts = data.attempts.filter(
                    (a) => a.user_id === e.student_id,
                  );
                  const scored = attempts.filter((a) => a.score !== null);
                  return (
                    <tr className="border-t" key={e.student_id}>
                      <td className="py-3">
                        <Link
                          href={`/teach/courses/${courseId}/students/${e.student_id}`}
                          className="font-medium text-indigo-700 hover:underline"
                        >
                          {data.profiles.find((p) => p.id === e.student_id)
                            ?.display_name || e.student_id}
                        </Link>
                      </td>
                      <td>
                        {completed}/{data.course.document.lessons.length} (
                        {data.course.document.lessons.length
                          ? Math.round(
                              (completed /
                                data.course.document.lessons.length) *
                                100,
                            )
                          : 0}
                        %)
                      </td>
                      <td>{attempts.length}</td>
                      <td>
                        {scored.length
                          ? scored
                              .map((a) => `${Math.round(a.score! * 100)}%`)
                              .join(", ")
                          : "—"}
                      </td>
                      <td>
                        <button
                          className="text-red-700 underline"
                          disabled={busy}
                          onClick={() => remove(`studentId=${e.student_id}`)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!!data.invitations.length && (
            <ul className="space-y-2 text-sm">
              {data.invitations.map((invitation) => (
                <li key={invitation.email} className="flex items-center justify-between gap-3 rounded border px-3 py-2">
                  <span>Pending invitation · {invitation.email}</span>
                  <button
                    className="text-red-700 underline"
                    disabled={busy}
                    onClick={() => remove(`email=${encodeURIComponent(invitation.email)}`)}
                  >
                    Revoke
                  </button>
                </li>
              ))}
            </ul>
          )}
          {data.attempts.map((a) => (
            <details className="rounded border p-3" key={a.id}>
              <summary>
                {data.profiles.find((p) => p.id === a.user_id)?.display_name ||
                  a.user_id}{" "}
                · {new Date(a.created_at).toLocaleString()} · revision{" "}
                {a.course_revision}
              </summary>
              <p className="my-2 whitespace-pre-wrap">{a.response}</p>
              <p>{a.feedback?.summary}</p>
              {a.feedback?.characterReply && <p>Character: {a.feedback.characterReply}</p>}
              {a.feedback?.criteria.map((c, i) => (
                <p className="mt-2" key={i}>
                  <strong>
                    {c.criterion}: {c.assessment}.
                  </strong>{" "}
                  {c.evidence} {c.suggestion}
                </p>
              ))}
              <p className="mt-2">Next: {a.feedback?.nextStep}</p>
            </details>
          ))}
          {!data.attempts.length && (
            <p className="text-stone-500">No submitted responses yet.</p>
          )}
        </>
      )}
    </section>
  );
}
