import Link from "next/link";
import { StatusPage } from "@/components/StatusPage";
import { BallotLink } from "./BallotLink";

/** 403 for a poll whose organiser publishes the results when voting ends. */
export default function ResultsHidden() {
  return (
    <StatusPage
      title="Results are hidden until this poll closes."
      description="The organiser chose to publish the count when voting ends, so nobody sees a running tally that could sway the rest of the vote. Come back after the poll closes."
      actions={<BallotLink />}
      footnote={
        <>
          Want to see a count now? <Link href="/elections">Browse the election replays</Link>.
        </>
      }
    />
  );
}
