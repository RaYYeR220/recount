import { ResultsHidden } from "@/components/results/ResultsHidden";
import { BallotLink } from "./BallotLink";

/** 403 when a client navigation reaches results that are hidden until close. */
export default function Forbidden() {
  return <ResultsHidden ballotLink={<BallotLink />} />;
}
