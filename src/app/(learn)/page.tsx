import Link from "next/link";
import { CourseCard } from "@/components/CourseCard";
import { LearnerHome } from "@/components/learning/LearnerHome";
import { listCourses } from "@/lib/learning/repository";
import { serverDb } from "@/lib/supabase/server";
import type { Course } from "@/lib/types";

export const dynamic = "force-dynamic";

const FORMATS = [
  { icon: "💬", title: "AI role-play", text: "Practise a conversation and reflect on evidence from your responses." },
  { icon: "🌍", title: "Any subject", text: "Learn languages, business, science or software engineering." },
  { icon: "✍️", title: "Thoughtful practice", text: "Respond to open tasks and revise with rubric-based feedback." },
  { icon: "🧑‍🏫", title: "Personal tutor", text: "An AI tutor that knows the lesson and explains it your way." },
];

async function hasSession() {
  const db = await serverDb();
  if (!db) return false;
  const { data } = await db.auth.getUser();
  return !!data.user;
}

export default async function Home() {
  const [courses, signedIn] = await Promise.all([listCourses(), hasSession()]);
  if (signedIn) return <LearnerHome courses={courses} />;
  return <Landing courses={courses} />;
}

function Landing({ courses }: { courses: Course[] }) {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-20">
      <section className="py-14 sm:py-20">
        <p className="text-sm font-semibold text-indigo-600">Interactive learning in any subject</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-bold tracking-tight text-stone-900 sm:text-5xl">
          Learn by exploring, practising and improving.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-stone-600">
          Explore short courses across subjects. Work through scenarios, explain your thinking and use AI feedback to improve. Teachers design and review each learning experience.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/onboarding" className="rounded-lg bg-indigo-600 px-5 py-3 font-medium text-white hover:bg-indigo-700">
            Personalise my learning
          </Link>
          <Link href="#courses" className="rounded-lg border border-stone-300 bg-white px-5 py-3 font-medium text-stone-700 hover:bg-stone-50">
            Browse courses
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FORMATS.map((f) => (
          <div key={f.title} className="rounded-2xl border border-stone-200 bg-white p-5">
            <span className="text-2xl">{f.icon}</span>
            <p className="mt-3 font-semibold text-stone-900">{f.title}</p>
            <p className="mt-1 text-sm text-stone-600">{f.text}</p>
          </div>
        ))}
      </section>

      <section id="courses" className="scroll-mt-20 pt-16">
        <h2 className="text-2xl font-bold text-stone-900">Courses</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {courses.map((c) => (
            <CourseCard key={c.id} course={c} />
          ))}
        </div>
      </section>
    </div>
  );
}
