import { Badge } from "@/components/ui/Badge";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { BrowserRecount } from "./BrowserRecount";
import { getAudit } from "./loaders";
import { Section } from "./Section";

/** The lunch vote's real audit files, and a recount that runs here. */
export async function Audit() {
  const audit = await getAudit();
  const lines = audit.csv.replace(/\n$/, "").split("\n");
  const { published } = audit;

  return (
    <Section
      id="audit"
      tone="walnut"
      title="Every result is recountable"
      lede="When a poll closes it publishes its cast-vote record, the record's SHA-256 and an RCTab summary. Anyone can fetch them, hash them, and count again. This is the lunch vote's real audit, and the button runs the recount here."
    >
      <div className="lp-audit grid12">
        <article className="paper lp-cvr" aria-labelledby="cvr-h">
          <header>
            <h3 className="title" id="cvr-h">
              Cast-vote record
            </h3>
            <Badge tone="neutral">CSV, anonymised</Badge>
          </header>
          <p className="lp-art-sub">One row per ballot, ordered by receipt, no receipts or names.</p>
          <pre className="lp-cvr-rows mono" tabIndex={0} aria-label={`${audit.title}: cast-vote record, ${lines.length - 1} ballots`}>
            {lines.map((line, i) => (
              <span key={i}>{line}</span>
            ))}
          </pre>
          <p className="lp-hash-label">SHA-256 of the file</p>
          <p className="lp-hash mono">
            <b>{audit.sha256.slice(0, 12)}</b>
            {audit.sha256.slice(12)}
          </p>
          <p className="lp-art-link">
            <a href={audit.cvrUrl}>Download the CSV</a>
          </p>
        </article>

        <article className="lp-rctab" aria-labelledby="rctab-h">
          <header>
            <h3 className="title" id="rctab-h">
              RCTab summary (JSON)
            </h3>
            <Badge tone="neutral" onDark>
              RCTab format
            </Badge>
          </header>
          <p className="lp-art-sub">The round-by-round summary in the format election offices already read.</p>
          <CodeBlock code={audit.rctab} language="json" label={`RCTab summary JSON for ${audit.title}`} className="lp-rctab-code" />
          <p className="lp-art-link">
            <a href={audit.rctabUrl}>The whole file</a>
          </p>
        </article>

        <article className="felt lp-recount" aria-labelledby="recount-h">
          <h3 className="title" id="recount-h">
            Recount in your browser
          </h3>
          <p className="lp-art-sub">Fetch the CSV from this site&apos;s API, hash it, count it with the poll&apos;s rules, compare.</p>
          <BrowserRecount cvrUrl={audit.cvrUrl} poll={audit.poll} published={published} />
          <div className="lp-published">
            <p className="lp-published-h">Published when the poll closed</p>
            <dl>
              <dt>Winner</dt>
              <dd>{published.winners.join(", ")}</dd>
              <dt>Rounds</dt>
              <dd>{published.rounds}</dd>
              <dt>Ballots</dt>
              <dd>{published.ballots}</dd>
              <dt>CVR SHA-256</dt>
              <dd className="mono">
                {published.sha256.slice(0, 32)}
                <br />
                {published.sha256.slice(32)}
              </dd>
            </dl>
          </div>
        </article>
      </div>
    </Section>
  );
}
