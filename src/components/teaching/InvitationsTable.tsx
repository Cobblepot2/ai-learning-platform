"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { TeachingInvitation } from "@/lib/teaching/invitations";

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year:
      date.getFullYear() === new Date().getFullYear()
        ? undefined
        : "numeric",
  }).format(date);
}

export function InvitationsTable({
  invitations,
}: {
  invitations: TeachingInvitation[];
}) {
  const router = useRouter();
  const [busyEmail, setBusyEmail] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function revoke(invitation: TeachingInvitation) {
    if (
      !confirm(
        `Revoke the invitation for ${invitation.email}? A student who already joined stays enrolled.`,
      )
    )
      return;
    setBusyEmail(invitation.email);
    setMessage("");
    setError("");
    try {
      const response = await fetch(
        `/api/enrolments?courseId=${invitation.courseId}&email=${encodeURIComponent(invitation.email)}`,
        { method: "DELETE" },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMessage(`Invitation for ${invitation.email} revoked.`);
      router.refresh();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusyEmail(null);
    }
  }

  return (
    <div className="space-y-4">
      {(message || error) && (
        <p
          role={error ? "alert" : "status"}
          className={`rounded-xl border p-4 text-sm ${
            error
              ? "border-rose-200 bg-rose-50 text-rose-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {error || message}
        </p>
      )}

      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Course</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Invited</th>
                <th className="px-5 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {invitations.map((invitation) => (
                <tr
                  key={`${invitation.courseId}:${invitation.email}`}
                  className="hover:bg-stone-50/70"
                >
                  <td className="px-5 py-4 font-medium text-stone-900">
                    {invitation.email}
                  </td>
                  <td className="px-4 py-4">
                    <Link
                      href={`/teach/courses/${invitation.courseId}`}
                      className="font-medium text-indigo-700 hover:underline"
                    >
                      {invitation.courseTitle}
                    </Link>
                  </td>
                  <td className="px-4 py-4 text-stone-600">
                    Waiting to be claimed
                  </td>
                  <td className="px-4 py-4 text-stone-500">
                    {formatDate(invitation.createdAt)}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button
                      type="button"
                      disabled={busyEmail === invitation.email}
                      onClick={() => void revoke(invitation)}
                      className="text-sm font-medium text-rose-700 underline underline-offset-2 disabled:opacity-50"
                    >
                      {busyEmail === invitation.email ? "Revoking…" : "Revoke"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
