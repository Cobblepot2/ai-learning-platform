import type { ChecklistItem, ProjectScenario } from "./types";

export type InterviewTurn = { role: "learner" | "client"; text: string };

export type InterviewReply = { reply: string; revealed: string[] };

/**
 * The only places a project scenario interprets free text. Implementations must
 * return ids from the lists they are given; the runtime validates them again.
 */
export interface ProjectEvaluator {
  interview(input: {
    scenario: ProjectScenario;
    question: string;
    turns: InterviewTurn[];
    revealed: string[];
    vagueIndex: number;
  }): Promise<InterviewReply>;
  checklist(input: { items: ChecklistItem[]; text: string }): Promise<string[]>;
}

/** Lower-case words separated by single spaces, padded so every word starts after a space. */
function normalise(text: string): string {
  return ` ${text.toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9']+/g, " ").trim()} `;
}

/**
 * A cue matches at the start of a word, so "cancel" matches "cancelled" but
 * "app" does not match "happen". Cues are normalised the same way as the text.
 */
function cueHits(text: string, cues: string[]): number {
  return cues.filter((cue) => {
    const needle = normalise(cue).trimEnd();
    return needle.trim() !== "" && text.includes(needle);
  }).length;
}

/**
 * Keyword-based stand-in for the AI. Used when no model is configured or a model
 * call fails, and in tests. It is deliberately simple and errs towards strictness.
 */
export const offlineEvaluator: ProjectEvaluator = {
  async interview({ scenario, question, revealed, vagueIndex }) {
    const text = normalise(question);
    const matches = scenario.facts
      .filter((fact) => !revealed.includes(fact.id))
      .map((fact) => ({ fact, hits: cueHits(text, fact.cues) }))
      .filter((match) => match.hits > 0)
      .sort((a, b) => b.hits - a.hits)
      // One fact per question keeps the conversation natural.
      .slice(0, 1);
    if (!matches.length) {
      const replies = scenario.interview.vagueReplies;
      return { reply: replies[vagueIndex % replies.length], revealed: [] };
    }
    return {
      reply: matches.map((match) => match.fact.reply).join(" "),
      revealed: matches.map((match) => match.fact.id),
    };
  },
  async checklist({ items, text }) {
    const body = normalise(text);
    return items
      .filter((item) => item.cues.every((group) => cueHits(body, group) > 0))
      .map((item) => item.id);
  },
};
