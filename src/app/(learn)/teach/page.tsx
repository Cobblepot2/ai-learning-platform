import type { Metadata } from "next";
import Link from "next/link";
import { glass } from "@/components/home/glass";
import { Reveal } from "@/components/home/Reveal";
import { CreateClass } from "@/components/teach/CreateClass";
import { listOwnClasses } from "@/lib/classes";
import { instructor } from "@/lib/instructor";
import type { serverDb } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Teach · DevPath" };

export default async function TeachPage() {
  const teacher = await instructor();
  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 pt-12 text-white lg:px-0 lg:pt-16">
      <Reveal>
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">Your classes</h1>
        <p className="mt-4 max-w-2xl text-lg text-white/65">
          Give each class a code, assign the projects it should play, and follow how every student gets on: where they are, how it ended and which ideas they caught.
        </p>
      </Reveal>
      {!teacher ? (
        <div className={`${glass} mt-10 p-7 text-white/75`}>
          <p className="text-lg">This page is for instructors.</p>
          <p className="mt-2 text-white/55">Ask an administrator to make your account an instructor. Students join a class with its code on the Projects page.</p>
        </div>
      ) : (
        <TeacherClasses db={teacher.db} ownerId={teacher.user.id} />
      )}
    </div>
  );
}

async function TeacherClasses({ db, ownerId }: { db: NonNullable<Awaited<ReturnType<typeof serverDb>>>; ownerId: string }) {
  const classes = await listOwnClasses(db, ownerId);
  return (
    <>
      <div className={`${glass} mt-10 p-7`}>
        <CreateClass />
      </div>
      <p className="mt-4 text-white/60">
        Want a project of your own? <Link href="/teach/projects" className="text-white underline hover:text-cyan-200">Create one from your teaching material, or customise an existing one.</Link>
      </p>
      <ul className="mt-8 grid gap-4 md:grid-cols-2">
        {classes.map((item) => (
          <li key={item.id}>
            <Link href={`/teach/${item.id}`} className={`${glass} block p-6 transition hover:border-white/40`}>
              <h2 className="text-xl font-semibold">{item.name}</h2>
              <p className="mt-2 text-sm text-white/55">
                {item.students} {item.students === 1 ? "student" : "students"} · code <span className="font-mono text-white/80">{item.join_code}</span>
              </p>
            </Link>
          </li>
        ))}
      </ul>
      {!classes.length && <p className="mt-6 text-white/50">No classes yet. Create one, then share its code with your students.</p>}
    </>
  );
}
