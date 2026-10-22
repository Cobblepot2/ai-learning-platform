import Link from "next/link";
import { buttonPrimary } from "@/components/blocks/BlockCard";
import { InvitationsTable } from "@/components/teaching/InvitationsTable";
import { requireAccount } from "@/lib/supabase/server";
import { loadTeachingInvitations } from "@/lib/teaching/invitations";

export const dynamic = "force-dynamic";

export default async function TeachingInvitationsPage() {
  const { db, user } = await requireAccount(true);
  const invitations = await loadTeachingInvitations(db, user.id);
  const uniqueEmails = new Set(invitations.map((row) => row.email)).size;
  const courses = new Set(invitations.map((row) => row.courseId)).size;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-indigo-600">Teaching studio</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-stone-900">
            Invitations
          </h1>
          <p className="mt-2 max-w-2xl text-stone-600">
            Pending invitations across every course. Students join with the
            invited email from My courses.
          </p>
        </div>
        <Link href="/teach/courses" className={buttonPrimary}>
          Invite from a course
        </Link>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-stone-500">Pending invitations</p>
          <p className="mt-2 text-3xl font-bold text-stone-900">
            {invitations.length}
          </p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-stone-500">Unique emails</p>
          <p className="mt-2 text-3xl font-bold text-stone-900">
            {uniqueEmails}
          </p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-stone-500">Courses</p>
          <p className="mt-2 text-3xl font-bold text-stone-900">{courses}</p>
        </div>
      </section>

      <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-900">
        Invitations are saved in the platform and claimed when the student signs
        in with that email. DevPath does not send invitation emails yet.
      </div>

      {invitations.length ? (
        <InvitationsTable invitations={invitations} />
      ) : (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <h2 className="font-semibold text-stone-900">
            No pending invitations
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-stone-600">
            Open a course&apos;s Students tab to invite people by email. Pending
            invitations appear here until they are claimed or revoked.
          </p>
          <Link href="/teach/courses" className={`${buttonPrimary} mt-5`}>
            Go to courses
          </Link>
        </div>
      )}
    </div>
  );
}
