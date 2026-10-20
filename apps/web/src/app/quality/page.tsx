import type { Metadata } from "next";
import Link from "next/link";
import { GateChain } from "@/components/quality/GateChain";
import { GateHistory } from "@/components/quality/GateHistory";
import { KillTable, type LiveVerdicts } from "@/components/quality/KillTable";
import { QualityFigures } from "@/components/quality/QualityFigures";
import { REPOSITORY_URL } from "@/components/shell/SiteFooter";
import { getGateHistory, getVerdicts } from "@/lib/quality/github";
import { mutants, quality } from "@/lib/quality/report";
import { GATES, latestVerdicts, type GateName } from "@/lib/quality/verdict";

export const metadata: Metadata = {
  title: "Quality",
  description: "The engine's test figures, the merge gates on every pull request and the saboteur's kill table, measured rather than written down.",
};

export default async function QualityPage() {
  const [history, feed] = await Promise.all([getGateHistory(), getVerdicts()]);
  const reported: Partial<Record<GateName, boolean>> = {};
  if (history.kind === "ok") for (const g of GATES) reported[g] = history.pulls.some((p) => p.gates[g] !== null);
  const live: LiveVerdicts = feed.kind === "ok" ? { kind: "ok", runs: latestVerdicts(feed.verdicts) } : { kind: "unavailable", reason: feed.reason };

  return (
    <div className="wrap page">
      <h1 className="display page-title">Tests that run themselves</h1>
      <p className="page-desc">
        Nothing on this page is typed in by hand. The engine&apos;s figures come from its test suite, run when this site was built; the gates and
        the saboteur&apos;s verdicts are read from GitHub every five minutes.
      </p>

      <QualityFigures quality={quality} />

      <section className="q-page-section" aria-labelledby="gates-h">
        <h2 className="title" id="gates-h">
          Merge gates
        </h2>
        <p>Every pull request meets the same three gates, in order. An unlit lamp has no run on record yet.</p>
        <div className="q-page-gates">
          <GateChain quality={quality} reported={reported} />
        </div>
      </section>

      <section className="q-page-section" aria-labelledby="history-h">
        <h2 className="title" id="history-h">
          Gate history
        </h2>
        <p>
          The <span className="mono">ci</span>, <span className="mono">preflight</span> and <span className="mono">TestSprite V3</span> results on
          the most recent pull requests of <a href={REPOSITORY_URL}>the repository</a>.
        </p>
        <GateHistory history={history} />
      </section>

      <section className="q-page-section" aria-labelledby="kill-table-h">
        <KillTable mutants={mutants} live={live} heading="h2" />
        <p className="q-run-meta">
          The catalog is <span className="mono">mutants/*/meta.json</span>, read when this site was built. Verdicts come from the comments the
          saboteur leaves on its closed pull requests. See <Link href="/#quality">the landing</Link> for how the gates fit together.
        </p>
      </section>
    </div>
  );
}
