import { REPOSITORY_URL } from "@/components/shell/SiteFooter";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import type { GateHistory as History } from "@/lib/quality/github";
import { GATES, type GateState } from "@/lib/quality/verdict";
import { GATE_LABEL, shortDate } from "./gates";

const TONE: Record<string, BadgeTone> = { success: "match", failure: "fail", pending: "info" };
const WORD: Record<string, string> = { success: "passed", failure: "failed", pending: "running" };

function Gate({ gate }: { gate: GateState | null }) {
  if (!gate) return <span className="q-ph">&mdash;</span>;
  const badge = (
    <Badge tone={TONE[gate.state] ?? "neutral"} onDark>
      {WORD[gate.state] ?? gate.state}
    </Badge>
  );
  return gate.url ? <a href={gate.url}>{badge}</a> : badge;
}

const checked = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC";

/** The three gates on each recent pull request, as GitHub reports them; an honest empty state otherwise. */
export function GateHistory({ history }: { history: History }) {
  if (history.kind === "unavailable" || history.pulls.length === 0) {
    return (
      <div className="paper q-empty">
        <EmptyState
          title="No gated pull requests yet."
          description={
            <>
              {history.kind === "unavailable" ? `${history.reason} ` : "No recent pull request has a ci, preflight or TestSprite V3 result yet. "}
              This table fills in from <a href={`${REPOSITORY_URL}/pulls`}>the repository&apos;s pull requests</a> every five minutes; nothing
              here is filled in by hand. Last checked {checked(history.checkedAt)}.
            </>
          }
        />
      </div>
    );
  }
  return (
    <div className="q-kill q-history-sheet">
      <div className="q-kill-scroll">
        <table className="q-kill-table">
          <caption className="sr-only">Merge gates on recent pull requests</caption>
          <thead>
            <tr>
              <th scope="col">Pull request</th>
              <th scope="col">State</th>
              {GATES.map((g) => (
                <th key={g} scope="col">
                  {GATE_LABEL[g]}
                </th>
              ))}
              <th scope="col">Updated</th>
            </tr>
          </thead>
          <tbody>
            {history.pulls.map((pr) => (
              <tr key={pr.number}>
                <th scope="row">
                  <a href={pr.url}>
                    #{pr.number} {pr.title}
                  </a>
                  {pr.saboteur ? (
                    <>
                      {" "}
                      <Badge tone="fail" onDark icon={false}>
                        saboteur
                      </Badge>
                    </>
                  ) : null}
                </th>
                <td>{pr.state}</td>
                {GATES.map((g) => (
                  <td key={g}>
                    <Gate gate={pr.gates[g]} />
                  </td>
                ))}
                <td>{shortDate(pr.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="q-run-meta q-kill-foot">Read from GitHub {checked(history.checkedAt)}; refreshed every five minutes.</p>
    </div>
  );
}
