import { Stepper } from "@/components/ui";

const STEPS = [{ label: "Rank" }, { label: "Review" }, { label: "Receipt" }];

/** Rank, Review, Receipt: where the voter is. */
export function VotingSteps({ current }: { current: 0 | 1 | 2 }) {
  return <Stepper label="Voting steps" steps={STEPS} current={current} variant="inline" className="mb-6 mt-1" />;
}
