"use client";

import { ActivityEditor } from "@/components/learning/ActivityEditor";
import { ActivitySummary } from "@/components/learning/ActivitySummary";
import {
  buttonPrimary as primary,
  buttonSecondary as secondary,
} from "@/components/blocks/BlockCard";
import { useStudio } from "./StudioContext";

export function ProposalReview() {
  const { acceptProposal, proposal, setProposal } = useStudio();

  if (!proposal) return null;

  return (
    <section className="space-y-3 rounded-xl border-2 border-indigo-400 bg-white p-4">
      <h2 className="font-semibold">Review proposed change</h2>
      <div className="grid gap-3 md:grid-cols-2">
        <ActivitySummary
          title="Before"
          activity={proposal.before}
          compareTo={proposal.after}
        />
        <div className="space-y-3">
          <ActivitySummary
            title="Proposed"
            activity={proposal.after}
            compareTo={proposal.before}
          />
          <ActivityEditor
            activity={proposal.after}
            onChange={(after) => setProposal({ ...proposal, after })}
          />
        </div>
      </div>
      <button className={primary} onClick={acceptProposal}>
        Accept into editor
      </button>
      <button className={`${secondary} ml-2`} onClick={() => setProposal(null)}>
        Reject
      </button>
    </section>
  );
}
