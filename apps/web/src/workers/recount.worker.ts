/**
 * Recounts a published result off the main thread. For a poll: fetch the exact
 * cast-vote record bytes, hash them, parse the CSV and count it with the poll's
 * rules and the tiebreak seed taken from that hash. For an election: fetch the
 * dataset, hash it, gunzip it, count it with its jurisdiction's preset and hold
 * every figure against the official report.
 */
import { compareToGolden, presetRules, tabulate, type ElectionDataset, type Golden } from "@recount/engine";
import { parseCsv, sha256Hex } from "@/lib/csv";
import type { ElectionRecount, ElectionRecountRequest, PollRecount, PollRecountRequest, RecountRequest, RecountStep, WorkerMessage } from "@/lib/recount";
import { tabulatePoll } from "@/server/results/tabulatePoll";

/** The parts of the worker's global scope used here (the DOM lib has no worker types). */
type WorkerScope = {
  postMessage(message: WorkerMessage): void;
  addEventListener(type: "message", listener: (event: MessageEvent<RecountRequest>) => void): void;
};

const scope = self as unknown as WorkerScope;
const post = (message: WorkerMessage) => scope.postMessage(message);
const step = (s: RecountStep) => post({ type: "progress", step: s });

async function download(url: string, what: string): Promise<Uint8Array<ArrayBuffer>> {
  const res = await fetch(url, { cache: "no-store", credentials: "same-origin" });
  if (!res.ok) throw new Error(`The ${what} could not be downloaded (HTTP ${res.status}).`);
  return new Uint8Array(await res.arrayBuffer());
}

async function gunzip(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  // A server that already sent it with Content-Encoding: gzip has been undone by fetch.
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return bytes;
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function recountPoll(req: PollRecountRequest): Promise<PollRecount> {
  step("fetch");
  const bytes = await download(req.csvUrl, "cast-vote record");
  step("hash");
  const sha256 = await sha256Hex(bytes);
  step("count");
  const [, ...rows] = parseCsv(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  const { results } = tabulatePoll(
    { title: "Recount", presetId: req.presetId, seats: req.seats, maxRanks: req.maxRanks },
    { labels: req.candidates, rows, sha256 },
    null,
  );
  step("compare");
  return { kind: "poll", sha256, rows: rows.length, winners: results.winners, rounds: results.rounds };
}

async function recountElection(req: ElectionRecountRequest): Promise<ElectionRecount> {
  step("fetch");
  const bytes = await download(req.datasetUrl, "ballot file");
  step("hash");
  const sha256 = await sha256Hex(bytes);
  step("unzip");
  const dataset = JSON.parse(new TextDecoder().decode(await gunzip(bytes))) as ElectionDataset;
  step("count");
  const result = tabulate({ candidates: dataset.candidates, ballots: dataset.ballots, rules: presetRules(dataset.presetId, dataset.seats) });
  step("compare");
  const golden = req.goldenUrl ? (JSON.parse(new TextDecoder().decode(await download(req.goldenUrl, "official report"))) as Golden) : null;
  const comparison = golden ? compareToGolden(result, dataset, golden) : null;
  const nameOf = new Map(dataset.candidates.map((c) => [c.id, c.name]));
  return {
    kind: "election",
    sha256,
    totalBallots: result.totalBallots,
    winners: result.winners.map((id) => nameOf.get(id) ?? id),
    rounds: result.rounds.length,
    cells: comparison?.cells ?? null,
    mismatches: comparison?.mismatches ?? [],
  };
}

scope.addEventListener("message", async (event: MessageEvent<RecountRequest>) => {
  try {
    const req = event.data;
    const result = req.kind === "poll" ? await recountPoll(req) : await recountElection(req);
    post({ type: "done", result });
  } catch (error) {
    post({ type: "error", message: error instanceof Error ? error.message : "The recount stopped unexpectedly." });
  }
});
