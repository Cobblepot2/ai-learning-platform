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

// Built from drafts (tidewater-swim.ts, parcelpal.ts): kept in step with the draft's title by tests/builtin.test.ts.
export const tidewaterSwimListing = {
  id: "tidewater-swim",
  title: "Tidewater Swim School sign-up",
  tagline: "Hand an AI coding agent someone else's code, then check what else it changed.",
  summary:
    "A swim school's online sign-up charges some families the wrong amount, and the freelancer who wrote it has gone. Brief the coding agent on code you didn't write, and check that its fix doesn't break what already worked.",
  minutes: 20,
  skills: ["Work on code you didn't write", "Brief an AI coding agent", "Check what else it changed", "Release and face the result"],
} as const satisfies ProjectListing;

export const parcelPalListing = {
  id: "parcelpal",
  title: "ParcelPal delivery charges",
  tagline: "Fix a bug that only happens on bad networks, without breaking the apps already out there.",
  summary:
    "A same-day delivery company keeps charging shops two or three times for one delivery, and the client is sure the server is just slow. Find out when it really happens, then brief the coding agent on a server that phone apps nobody can force to update depend on.",
  minutes: 20,
  skills: ["Question the client's theory", "Brief an AI coding agent", "Review its work", "Release and face the result"],
} as const satisfies ProjectListing;

// A statistics job for a nursing student, from docs/scenarios/examples (ward-infection-audit.ts).
export const wardInfectionAuditListing = {
  id: "ward-infection-audit",
  title: "Ward 4B Infection Audit",
  tagline: "Beyond software: check an AI analyst's statistics before a hospital committee sees them.",
  summary:
    "A ward manager wants proof that a new hand gel cut infections on her ward. You lead the audit as a nursing student: find out what the numbers really show, brief the AI statistical analyst, review its findings and decide how to report them.",
  minutes: 20,
  skills: ["Question the client's evidence", "Brief an AI analyst", "Review its findings", "Report and face the result"],
} as const satisfies ProjectListing;

export const projectListings: readonly ProjectListing[] = [harbourClinicListing, tidewaterSwimListing, parcelPalListing, wardInfectionAuditListing];
