import type { ReactNode } from "react";
import { PanelHeader, Paper } from "@/components/ui/Surface";
import type { ElectionReplay } from "@/server/elections";

function Sha({ value }: { value: string }) {
  return (
    <span className="sha">
      <b>{value.slice(0, 12)}</b>
      {value.slice(12)}
    </span>
  );
}

function Url({ href }: { href: string }) {
  let host = href;
  try {
    host = new URL(href).hostname.replace(/^www\./, "");
  } catch {}
  return (
    <a href={href} rel="noopener noreferrer" className="font-bold">
      {host}
    </a>
  );
}

/** Where the ballots and the official figures come from, each with its SHA-256. */
export function SourcesPanel({ replay, datasetPath, children, id = "sources-h" }: { replay: ElectionReplay; datasetPath: string; children?: ReactNode; id?: string }) {
  const { source, golden } = replay;
  return (
    <Paper as="section" aria-labelledby={id}>
      <PanelHeader id={id} title="Sources" />
      <dl className="facts">
        <dt>Ballots</dt>
        <dd>
          {source.publisher}, {source.license.toLowerCase() === "public record" ? "public record" : source.license}.{" "}
          {source.contest ? <>Contest &ldquo;{source.contest}&rdquo;. </> : null}
          <Url href={source.url} />
        </dd>
        <dt>Original file</dt>
        <dd>
          <span className="mono text-xs">{source.file.split("/").pop()}</span>
          <br />
          <Sha value={source.sha256} />
        </dd>
        <dt>Replay data</dt>
        <dd>
          <a href={datasetPath} className="font-bold">
            {datasetPath.split("/").pop()}
          </a>
          <br />
          <Sha value={replay.datasetSha256} />
        </dd>
        {golden ? (
          <>
            <dt>Official figures</dt>
            <dd>
              <Url href={golden.sourceUrl} />
              {golden.reportSha256 ? (
                <>
                  <br />
                  <Sha value={golden.reportSha256} />
                </>
              ) : null}
              {golden.transcribedFrom ? (
                <>
                  <br />
                  Transcribed from <Url href={golden.transcribedFrom.url} />
                </>
              ) : null}
            </dd>
          </>
        ) : null}
        <dt>Retrieved</dt>
        <dd>{source.retrievedAt}</dd>
      </dl>
      {golden?.notes ? <p className="hint-line">{golden.notes}</p> : null}
      {children}
    </Paper>
  );
}
