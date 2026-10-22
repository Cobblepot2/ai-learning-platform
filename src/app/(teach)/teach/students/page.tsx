import Link from "next/link";
import { buttonSecondary } from "@/components/blocks/BlockCard";
import { requireAccount } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/teaching/course";
import { loadTeachingStudents } from "@/lib/teaching/students";

export const dynamic = "force-dynamic";

export default async function TeachingStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { db, user } = await requireAccount(true);
  const params = await searchParams;
  const q = (Array.isArray(params.q) ? params.q[0] : params.q)?.trim() ?? "";
  const students = await loadTeachingStudents(db, user.id, q);

  const enrolledSeats = students.reduce(
    (total, student) => total + student.courses.length,
    0,
  );
  const submissions = students.reduce(
    (total, student) => total + student.submissions,
    0,
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-indigo-600">Teaching studio</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-stone-900">
            Students
          </h1>
          <p className="mt-2 max-w-2xl text-stone-600">
            Everyone enrolled across your courses. Open a student to review
            lesson progress and submitted work.
          </p>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-stone-500">Unique students</p>
          <p className="mt-2 text-3xl font-bold text-stone-900">
            {students.length}
          </p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-stone-500">Enrolled seats</p>
          <p className="mt-2 text-3xl font-bold text-stone-900">
            {enrolledSeats}
          </p>
          <p className="mt-1 text-xs text-stone-500">Across all your courses</p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-stone-500">Submissions</p>
          <p className="mt-2 text-3xl font-bold text-stone-900">{submissions}</p>
        </div>
      </section>

      <form method="get" className="flex flex-wrap items-center gap-3">
        <label htmlFor="student-search" className="sr-only">
          Search students
        </label>
        <input
          id="student-search"
          name="q"
          defaultValue={q}
          placeholder="Search by name or student ID"
          className="min-w-64 flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm sm:max-w-sm"
        />
        <button type="submit" className={buttonSecondary}>
          Search
        </button>
        {q && (
          <Link
            href="/teach/students"
            className="text-sm font-medium text-stone-500 hover:text-stone-800"
          >
            Clear
          </Link>
        )}
      </form>

      {students.length ? (
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Student</th>
                  <th className="px-4 py-3 font-medium">Courses</th>
                  <th className="px-4 py-3 font-medium">Lessons complete</th>
                  <th className="px-4 py-3 font-medium">Submissions</th>
                  <th className="px-5 py-3 font-medium">Last activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {students.map((student) => (
                  <tr key={student.id} className="align-top hover:bg-stone-50/70">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-stone-900">
                        {student.name}
                      </p>
                      <p className="mt-0.5 font-mono text-xs text-stone-400">
                        {student.id.slice(0, 8)}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex max-w-md flex-wrap gap-1.5">
                        {student.courses.map((course) => (
                          <Link
                            key={course.id}
                            href={`/teach/courses/${course.id}/students/${student.id}`}
                            className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 transition hover:bg-indigo-100"
                          >
                            {course.title}
                          </Link>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-stone-700">
                      {student.completedLessons}
                    </td>
                    <td className="px-4 py-4 text-stone-700">
                      {student.submissions}
                    </td>
                    <td className="px-5 py-4 text-stone-500">
                      {formatDateTime(student.lastActiveAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <h2 className="font-semibold text-stone-900">
            {q ? "No matching students" : "No enrolled students yet"}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-stone-600">
            {q
              ? "Try a different name or student ID, or clear the search."
              : "Invite students from a course's Students tab. They appear here after joining."}
          </p>
          {q ? (
            <Link
              href="/teach/students"
              className={`${buttonSecondary} mt-5`}
            >
              Clear search
            </Link>
          ) : (
            <Link href="/teach/courses" className={`${buttonSecondary} mt-5`}>
              Go to courses
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
