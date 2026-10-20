import { BallotLinkFromAddress } from "@/components/results/BallotLinkFromAddress";
import { ResultsHidden } from "@/components/results/ResultsHidden";

export default function Forbidden() {
  return <ResultsHidden ballotLink={<BallotLinkFromAddress />} />;
}
