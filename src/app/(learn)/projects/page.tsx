import type { Metadata } from "next";
import Link from "next/link";
import { Reveal } from "@/components/home/Reveal";
import { SpotlightCard } from "@/components/home/SpotlightCard";
import { projectListings } from "@/lib/projects/catalog";

export const metadata: Metadata = { title: "Projects · DevPath" };

export default function ProjectsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 pt-12 text-white lg:px-0 lg:pt-16">
      <Reveal>
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">Projects</h1>
        <p className="mt-4 max-w-2xl text-lg text-white/65">
          Each project is a different client with a different problem. Your progress is saved as you go, so you can stop and pick up later.
        </p>
      </Reveal>
      <div className="mt-12 grid gap-5 md:grid-cols-2">
        {projectListings.map((project) => (
          <SpotlightCard key={project.id} className="flex h-full flex-col p-7">
            <p className="text-sm text-white/50">About {project.minutes} minutes</p>
            <h2 className="mt-2 text-2xl font-semibold">{project.title}</h2>
            <p className="mt-2 text-white/75">{project.tagline}</p>
            <p className="mt-3 leading-relaxed text-white/60">{project.summary}</p>
            <ul className="mt-5 flex flex-wrap gap-2">
              {project.skills.map((skill) => (
                <li key={skill} className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/75">{skill}</li>
              ))}
            </ul>
            <Link
              href={`/projects/${project.id}`}
              className="mt-7 inline-flex self-start rounded-full bg-white px-7 py-3 text-[15px] font-medium text-black transition hover:bg-white/85"
            >
              Open the desktop
            </Link>
          </SpotlightCard>
        ))}
        <SpotlightCard delay={100} className="grid min-h-56 place-items-center border-dashed p-7 text-center text-white/45">
          More projects are on the way.
        </SpotlightCard>
      </div>
    </div>
  );
}
