import Link from "next/link";
import { redirect } from "next/navigation";
import { TeachShell } from "@/components/teaching/TeachShell";
import { HttpError, requireAccount } from "@/lib/supabase/server";

function AccessMessage({ status }: { status: number }) {
  const unavailable = status === 503;
  return (
    <main className="grid min-h-screen place-items-center bg-stone-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm">
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-indigo-100 text-sm font-bold text-indigo-700">
          DP
        </span>
        <h1 className="mt-5 text-xl font-bold text-stone-900">
          {unavailable
            ? "Teaching workspace unavailable"
            : "Instructor access required"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-stone-600">
          {unavailable
            ? "Course accounts are not configured on this deployment yet. Add the Supabase environment variables and try again."
            : "Your account is signed in, but an administrator must assign the instructor role before you can open the teaching workspace."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
          >
            Back to learning
          </Link>
          <Link
            href="/my-courses"
            className="inline-flex items-center justify-center rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
          >
            My private courses
          </Link>
        </div>
      </div>
    </main>
  );
}

export default async function TeachingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let status: number | null = null;
  try {
    await requireAccount(true);
  } catch (error) {
    status = error instanceof HttpError ? error.status : 500;
  }

  if (status === 401) redirect("/login");
  if (status) return <AccessMessage status={status} />;

  return <TeachShell>{children}</TeachShell>;
}
