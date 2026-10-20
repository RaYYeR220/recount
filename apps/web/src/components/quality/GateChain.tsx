import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import type { QualityReport } from "@/lib/quality/report";
import type { GateName } from "@/lib/quality/verdict";

type Gate = { title: string; lamp: "lit" | "dark" | "merge"; body: ReactNode };

export type GateChainProps = {
  quality: QualityReport;
  /** Gates GitHub has reported a run of. Preflight and TestSprite stay unlit until they have one. */
  reported?: Partial<Record<GateName, boolean>>;
};

/**
 * The merge gate as a chain of lamps: pull request, CI, Preflight, TestSprite,
 * merge. CI's figures come from the engine's test run when this deployment was built.
 */
export function GateChain({ quality, reported = {} }: GateChainProps) {
  const { engine, rctabFixtures: f, replays: r } = quality;
  const lamp = (gate: GateName) => (reported[gate] ? "lit" : "dark");
  const gates: Gate[] = [
    { title: "Pull request", lamp: "lit", body: <p>From a person, or from the saboteur with one planted bug.</p> },
    {
      title: "CI",
      lamp: "lit",
      body: (
        <ul className="q-gate-figs">
          <li>
            <b className="num">{engine.tests}</b> engine tests{engine.failed > 0 ? `, ${engine.failed} failing` : ""}
          </li>
          <li>
            <b className="num">{f.passed}</b> of <b className="num">{f.total}</b> RCTab rules fixtures
          </li>
          <li>
            <b className="num">{r.exact}</b> elections match the official count exactly
          </li>
        </ul>
      ),
    },
    {
      title: "Preflight",
      lamp: lamp("preflight"),
      body: <p>Every route on the preview deploy answers with the right status, the seeded polls are there, and the console is clean.</p>,
    },
    {
      title: "TestSprite",
      lamp: lamp("TestSprite V3"),
      body: <p>Plays the UI scenarios in a real browser against the same preview deploy, as a voter, an organiser and an intruder would.</p>,
    },
    { title: "Merge", lamp: "merge", body: <p>Only when all three are green. A saboteur pull request never merges: its verdict closes it.</p> },
  ];

  return (
    <ol className="q-gates" aria-label="Merge gate">
      {gates.map((g) => (
        <li key={g.title} className={cx("q-gate", g.lamp === "dark" && "is-dark", g.lamp === "merge" && "is-merge")}>
          <span className="q-gate-lamp" aria-hidden="true" />
          <h3 className="title">{g.title}</h3>
          {g.body}
        </li>
      ))}
    </ol>
  );
}
