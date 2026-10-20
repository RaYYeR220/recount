import type { ReactNode } from "react";
import { REPOSITORY_URL } from "@/components/shell/SiteFooter";
import { Badge } from "@/components/ui/Badge";
import { cx } from "@/lib/cx";
import type { Mutant } from "@/lib/quality/report";
import type { MutantRuns, Verdict } from "@/lib/quality/verdict";
import { caughtByTest, expectedKillerLabel, fixCommit, gateLabel, shortDate } from "./gates";

export type LiveVerdicts = { kind: "ok"; runs: Map<string, MutantRuns> } | { kind: "unavailable"; reason: string };

function verdictBadge(v: Verdict): ReactNode {
  switch (v.verdict) {
    case "killed":
      return <Badge tone="match" onDark>Caught by {gateLabel(v.killedBy ?? "")}</Badge>;
    case "survived":
      return <Badge tone="fail" onDark>Survived every gate</Badge>;
    case "timed out":
      return <Badge tone="warn" onDark>Timed out</Badge>;
    case "control passed":
      return <Badge tone="match" onDark>Every gate stayed green</Badge>;
    case "control failed":
      return <Badge tone="fail" onDark>Control failed {gateLabel(v.killedBy ?? "")}</Badge>;
  }
}

function History({ mutant }: { mutant: Mutant }) {
  if (mutant.history.length === 0) return null;
  return (
    <ul className="q-history">
      {mutant.history.map((h) => {
        const [what, ...rest] = h.event.split(": ");
        const fix = fixCommit(h.fix);
        return (
          <li key={`${h.date}${h.fix}`}>
            <Badge tone="warn" onDark>
              {what} {shortDate(h.date)}
            </Badge>{" "}
            {rest.join(": ")} Test added afterwards:{" "}
            {fix.sha ? (
              <a href={`${REPOSITORY_URL}/commit/${fix.sha}`} className="mono">
                {fix.sha}
              </a>
            ) : null}{" "}
            {fix.subject}
          </li>
        );
      })}
    </ul>
  );
}

function CaughtBy({ mutant }: { mutant: Mutant }) {
  if (mutant.caughtBy.length === 0) return <span className="q-muted">Nothing should: it changes a comment.</span>;
  return (
    <ul className="q-caught">
      {mutant.caughtBy.map((entry) => {
        const { gate, test } = caughtByTest(entry);
        return (
          <li key={entry}>
            <span className="q-caught-gate">{gate}</span> {test}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Every planted bug in mutants/, the gate expected to catch it and the tests that
 * do. With `live`, the latest verdict the saboteur recorded on GitHub for each one;
 * "—" where it has not run yet.
 */
export function KillTable({ mutants, live, heading = "h3" }: { mutants: Mutant[]; live?: LiveVerdicts; heading?: "h2" | "h3" }) {
  const Heading = heading;
  const survivors = mutants.filter((m) => m.history.length > 0).length;
  return (
    <div className="q-kill">
      <div className="q-kill-head">
        <Heading className="title" id="kill-table-h">
          Saboteur kill table
        </Heading>
        <p>
          Each mutant is one realistic bug in one layer, planted on a fresh branch. A gate kills it when it turns red.
          {survivors > 0
            ? ` ${survivors} of ${mutants.length} got through CI the first time. Each now has a test that catches it, and the table keeps that history.`
            : ""}
          {live?.kind === "unavailable" ? ` Live verdicts: ${live.reason}` : ""}
        </p>
      </div>
      <div className="q-kill-scroll">
        <table className={cx("q-kill-table", live && "has-live")} aria-labelledby="kill-table-h">
          <thead>
            <tr>
              <th scope="col">Mutant</th>
              <th scope="col">Layer</th>
              <th scope="col">Planted bug</th>
              <th scope="col">Expected killer</th>
              <th scope="col">Caught by</th>
              {live ? (
                <>
                  <th scope="col">Last verdict</th>
                  <th scope="col" className="num">
                    Runs
                  </th>
                </>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {mutants.map((m) => {
              const runs = live?.kind === "ok" ? live.runs.get(m.id) : undefined;
              return (
                <tr key={m.id}>
                  <th scope="row">
                    <span className="q-mut">
                      <i className={cx("q-mut-chit", m.layer === "control" && "is-control")} aria-hidden="true" />
                      {m.id}
                    </span>
                  </th>
                  <td className="c-layer">
                    <span className="q-layer">{m.layer}</span>
                  </td>
                  <td className="c-bug">
                    {m.bug}
                    <History mutant={m} />
                  </td>
                  <td className="c-exp">{expectedKillerLabel(m.expectedKiller)}</td>
                  <td className="c-by">
                    <CaughtBy mutant={m} />
                  </td>
                  {live ? (
                    <>
                      <td className="c-verdict">
                        {runs ? (
                          <>
                            {verdictBadge(runs.latest)}
                            {runs.latest.killedBy && runs.latest.gates[runs.latest.killedBy as keyof Verdict["gates"]]?.step ? (
                              <small>at “{runs.latest.gates[runs.latest.killedBy as keyof Verdict["gates"]]!.step}”</small>
                            ) : null}
                          </>
                        ) : (
                          <b className="q-ph" aria-label="No run yet">
                            &mdash;
                          </b>
                        )}
                      </td>
                      <td className="num c-run">
                        {runs ? (
                          <a href={`${REPOSITORY_URL}/pull/${runs.latest.pr}`}>
                            {runs.runs} {runs.runs === 1 ? "run" : "runs"}, last {shortDate(runs.latest.at)}
                          </a>
                        ) : (
                          <b className="q-ph" aria-label="No run yet">
                            &mdash;
                          </b>
                        )}
                      </td>
                    </>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
