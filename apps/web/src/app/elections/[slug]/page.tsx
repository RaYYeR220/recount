import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ElectionRecount } from "@/components/elections/ElectionRecount";
import { GoldenDiff } from "@/components/elections/GoldenDiff";
import { matchLabel, reportName } from "@/components/elections/matchLabel";
import { PathologyExplainer } from "@/components/elections/PathologyExplainer";
import { replayView } from "@/components/elections/replayView";
import { SourcesPanel } from "@/components/elections/SourcesPanel";
import { ResultsLayout } from "@/components/results/ResultsLayout";
import { WinnerCard } from "@/components/results/WinnerCard";
import { Badge } from "@/components/ui/Badge";
import { PanelHeader, Paper } from "@/components/ui/Surface";
import { buildCountScene } from "@/lib/countScene";
import { presetLabel } from "@/lib/presetNames";
import { formatCount } from "@/lib/votes";
import { electionList, electionReplay } from "../data";
import "@/styles/results.css";

/** Every replay is prerendered; an unknown slug waits for the lookup so it can answer 404. */
export const instant = false;

export async function generateStaticParams() {
  return (await electionList()).map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: PageProps<"/elections/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const entry = (await electionList()).find((e) => e.slug === slug);
  if (!entry) return { title: "Election not found" };
  return {
    title: entry.title,
    description: `${entry.title}, recounted round by round from ${formatCount(entry.ballots)} ballots and compared figure by figure with the official report.`,
  };
}

function longDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

export default async function ElectionPage({ params }: PageProps<"/elections/[slug]">) {
  const { slug } = await params;
  const entry = (await electionList()).find((e) => e.slug === slug);
  if (!entry) notFound();
  const { replay, analysis } = await electionReplay(slug);
  const { view, scene, official, mismatches } = replayView(replay, analysis);
  const label = matchLabel(replay.presetId, mismatches);
  const against = reportName(replay.presetId);
  const cells = replay.comparison?.cells ?? null;
  const datasetPath = `/elections/${entry.file}`;
  const conventionNote =
    replay.reportConvention.inactive === "afterFirstRound"
      ? `The official report counts inactive ballots differently: ${replay.reportConvention.notes ?? "ballots inactive from round 1 are reported as undervotes."}`
      : replay.reportConvention.notes;

  return (
    <div className="wrap page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/elections">Elections</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{replay.jurisdiction}</span>
      </nav>

      <div className="res-head">
        <div className="min-w-0">
          <h1 className="display page-title">{replay.title}</h1>
          <p className="page-desc">
            {replay.office}, {longDate(replay.date)}. Counted again from {formatCount(replay.totalBallots)} ballots under {presetLabel(replay.presetId)} rules.
          </p>
          <div className="meta-row">
            <Badge onDark>{replay.seats === 1 ? "1 seat" : `${replay.seats} seats`}</Badge>
            <Badge onDark>{formatCount(replay.totalBallots)} ballots</Badge>
            <Badge onDark>{presetLabel(replay.presetId)} rules</Badge>
            {cells !== null ? (
              <Badge onDark tone={label.tone}>
                {label.text}
              </Badge>
            ) : null}
          </div>
        </div>
        <WinnerCard view={view} />
      </div>

      <ResultsLayout
        view={view}
        scene={buildCountScene({ rounds: view.rounds, options: view.options, seats: view.seats, ...scene })}
        title={`${replay.title}: the count, round by round`}
        seedSource={`seed ${replay.rules.randomSeed ?? "0"}`}
        inactiveNote={conventionNote}
        sideFirst={<PathologyExplainer view={view} />}
        main={
          official && cells !== null ? (
            <GoldenDiff official={official} winners={view.winners} cells={cells} mismatches={mismatches} label={label} against={against} />
          ) : null
        }
        side={
          <>
            <Paper as="section" aria-labelledby="proof-h">
              <PanelHeader id="proof-h" title="Check it yourself" />
              <p className="text-sm text-ink-2">
                This page was counted by the engine when the site was built. Count it again here: your browser downloads the same ballots and runs the same
                rules.
              </p>
              <ElectionRecount
                request={{ kind: "election", datasetUrl: datasetPath, goldenUrl: entry.golden ? `/elections/${entry.golden.file}` : null }}
                published={{
                  sha256: replay.datasetSha256,
                  winners: replay.winners,
                  rounds: replay.rounds.length,
                  cells,
                  mismatches: mismatches.length,
                  against,
                }}
                seats={replay.seats}
              />
            </Paper>
            <SourcesPanel replay={replay} datasetPath={datasetPath} />
          </>
        }
      />
    </div>
  );
}
