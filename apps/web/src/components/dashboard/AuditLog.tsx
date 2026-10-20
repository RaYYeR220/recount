import { PanelHeader, Paper } from "@/components/ui";
import { plural } from "@/lib/pollText";
import { formatWhen } from "@/lib/when";
import type { AuditEntry } from "@/server/audit";

const FIELD_NAMES: Record<string, string> = {
  title: "title",
  description: "description",
  options: "options",
  seats: "seats",
  presetId: "counting rules",
  maxRanks: "ranking limit",
  accessMode: "access",
  resultsVisibility: "results visibility",
  timeZone: "time zone",
  opensAt: "opening time",
  closesAt: "closing time",
};

/** One audit event in plain words. Details never include ballot content. */
export function describeAudit(entry: AuditEntry): string {
  const detail = (entry.detail ?? {}) as { fields?: string[]; count?: number; cvrSha256?: string };
  switch (entry.type) {
    case "poll.created":
      return "Poll created.";
    case "poll.updated": {
      const fields = (detail.fields ?? []).map((f) => FIELD_NAMES[f] ?? f);
      return fields.length ? `Changed the ${fields.join(", ")}.` : "Settings changed.";
    }
    case "poll.closed":
      return detail.cvrSha256 ? `Voting closed. CVR SHA-256 ${detail.cvrSha256.slice(0, 12)}… saved with the count.` : "Voting closed.";
    case "codes.generated":
      return `${plural(detail.count ?? 0, "invite code")} generated.`;
    case "poll.deleted":
      return "Poll deleted.";
  }
}

/** Everything the organizer did to the poll, oldest first, times in the poll's zone. */
export function AuditLog({ entries, timeZone }: { entries: AuditEntry[]; timeZone: string }) {
  return (
    <Paper as="section" aria-labelledby="audit-title">
      <PanelHeader id="audit-title" title="Audit log" description={`Times in ${timeZone}`} />
      <ol className="m-0 grid list-none gap-0 p-0">
        {entries.map((entry, i) => (
          <li key={i} className="grid gap-x-4 gap-y-0.5 border-b border-paper-3 py-2.5 text-sm last:border-b-0 sm:grid-cols-[13rem_minmax(0,1fr)]">
            <time dateTime={entry.at.toISOString()} className="num text-ink-3">
              {formatWhen(entry.at, timeZone, { short: true })}
            </time>
            <span className="text-ink [overflow-wrap:anywhere]">{describeAudit(entry)}</span>
          </li>
        ))}
      </ol>
    </Paper>
  );
}
