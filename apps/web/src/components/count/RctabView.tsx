"use client";

import type { RctabSummary } from "@recount/engine";
import { Button } from "@/components/ui/Button";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { PanelHeader, Paper } from "@/components/ui/Surface";

function download(json: string) {
  const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "recount-summary.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** The count in RCTab's summary format, a download of it, and the same count through the API. */
export function RctabView({ summary, body }: { summary: RctabSummary; body: unknown }) {
  const json = JSON.stringify(summary, null, 2);
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const curl = `curl -X POST '${origin}/api/v1/tabulate?format=rctab' \\\n  -H 'content-type: application/json' \\\n  -d '${JSON.stringify(body).replace(/'/g, "'\\''")}'`;

  return (
    <div className="grid gap-[var(--gutter)] lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
      <Paper as="section" aria-labelledby="rctab-h">
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
          <PanelHeader id="rctab-h" title="RCTab summary (JSON)" className="mb-0" />
          <Button variant="line" size="sm" onClick={() => download(json)}>
            Download the file
          </Button>
        </div>
        <CodeBlock code={json} language="json" label="RCTab summary of this count" className="max-h-[560px]" />
      </Paper>
      <Paper as="section" aria-labelledby="api-h">
        <PanelHeader id="api-h" title="The same count through the API" />
        <p className="mb-3 text-sm text-ink-2">POST the ballots to the tabulate endpoint and the answer is this file, figure for figure. Nothing is stored.</p>
        <CodeBlock code={curl} language="shell" label="API request for this count" className="max-h-[480px] whitespace-pre-wrap break-all" />
      </Paper>
    </div>
  );
}
