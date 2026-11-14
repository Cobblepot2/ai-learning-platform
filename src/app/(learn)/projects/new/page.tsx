import type { Metadata } from "next";
import { Reveal } from "@/components/home/Reveal";
import { CreateProject } from "@/components/projects/CreateProject";

export const metadata: Metadata = { title: "Create a project · DevPath" };

export default async function NewProjectPage({ searchParams }: { searchParams: Promise<{ subject?: string }> }) {
  const { subject } = await searchParams;
  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-12 text-white lg:px-0 lg:pt-16">
      <Reveal>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Create a project</h1>
        <p className="mt-4 text-lg text-white/65">
          Tell us who you are and what you want to learn. The AI writes a client with a real problem, an AI teammate and everything that can go wrong, set in your world. It plays on the same desktop as every other project.
        </p>
      </Reveal>
      <div className="mt-10">
        <CreateProject initialSubject={subject?.trim().slice(0, 80) ?? ""} />
      </div>
    </div>
  );
}
