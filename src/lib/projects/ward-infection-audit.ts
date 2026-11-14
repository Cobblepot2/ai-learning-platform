import { buildScenario } from "./generated/build";
import { projectDraftSchema } from "./generated/draft";
import raw from "../../../docs/scenarios/examples/statistics-hand-gel-audit.json";

/*
 * Ward 4B Infection Audit: statistics for a nursing student. The draft was
 * written by gemini-3.5-flash (two lines reworded by hand) and is kept in
 * docs/scenarios/examples, where the generator's tests also read it. The AI
 * teammate is a statistical analyst, and there is no code to review, so it has
 * the product lead role only.
 */
export const wardInfectionAuditDraft = projectDraftSchema.parse(raw);

export const wardInfectionAudit = buildScenario(wardInfectionAuditDraft, { id: "ward-infection-audit" });
