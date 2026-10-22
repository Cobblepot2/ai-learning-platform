import Link from "next/link";
import { NewCoursePanel } from "@/components/teaching/NewCoursePanel";

export const dynamic = "force-dynamic";

export default function NewCoursePage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 lg:px-8">
      <div>
        <Link
          href="/teach/courses"
          className="text-sm font-medium text-stone-500 transition hover:text-indigo-700"
        >
          ← All courses
        </Link>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-stone-900">
          Create a course
        </h1>
        <p className="mt-2 max-w-2xl text-stone-600">
          Choose a starting point. You can edit every lesson and activity before
          publishing.
        </p>
      </div>
      <NewCoursePanel />
    </div>
  );
}
