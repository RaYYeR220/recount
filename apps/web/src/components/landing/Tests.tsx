import Link from "next/link";
import { GateChain } from "@/components/quality/GateChain";
import { KillTable } from "@/components/quality/KillTable";
import { mutants, quality } from "@/lib/quality/report";
import { Section } from "./Section";

/** The merge gate and the saboteur's catalog, with CI's figures from this build's test run. */
export function Tests() {
  return (
    <Section
      id="quality"
      tone="dark"
      title="Tests that run themselves"
      lede="No pull request merges until three gates pass. A saboteur keeps opening pull requests with planted bugs, so the gates have to prove they still bite."
    >
      <GateChain quality={quality} />
      <p className="q-gates-note">
        CI&apos;s figures are from the engine&apos;s test run when this site was built. Unlit gates have no run on record here;{" "}
        <Link href="/quality">the quality page</Link> shows every gate on every recent pull request as GitHub reports it.
      </p>
      <KillTable mutants={mutants} />
    </Section>
  );
}
