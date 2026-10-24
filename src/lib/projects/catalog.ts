/**
 * Public, browser-safe facts about each project. The full scenarios (code
 * variants, checklists, hidden facts) live in server-only modules and must not
 * be imported from client components.
 */
export interface ProjectListing {
  id: string;
  title: string;
  tagline: string;
  summary: string;
  minutes: number;
  /** What the learner does with the AI teammates, shown as tags. */
  skills: string[];
}

export const harbourClinicListing = {
  id: "harbour-clinic",
  title: "Harbour Clinic booking board",
  tagline: "Lead a two-week job with an AI client, an AI coding agent and a real deadline.",
  summary:
    "A small clinic keeps double-booking its morning appointments. You lead the job: find out what is really wrong, tell the coding agent what to build, review what it delivers and decide how to release it. Every decision changes what happens next.",
  minutes: 20,
  skills: ["Interview an AI client", "Brief an AI coding agent", "Review its work", "Release and face the result"],
} as const satisfies ProjectListing;

export const projectListings: readonly ProjectListing[] = [harbourClinicListing];
