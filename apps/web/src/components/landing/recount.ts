import { tabulate } from "@recount/engine";
import { patternsFromRows, pollRules } from "@/server/results/tabulatePoll";
import type { Published, RecountPoll } from "./auditData";

/** RFC 4180 fields: commas, quoted fields with "" for a quote, CRLF or LF line ends. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export async function sha256Hex(bytes: ArrayBuffer | Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export type RecountOutcome = {
  ballots: number;
  columns: number;
  sha256: string;
  hashMatches: boolean;
  winners: string[];
  rounds: number;
  countMatches: boolean;
};

/**
 * Recounts a cast-vote record the way anyone could: hash the bytes as served, read
 * the rows, count them with the poll's own rules (tiebreak seeded from the hash),
 * and compare winner, rounds and hash with what the poll published.
 */
export async function recountCvr(bytes: ArrayBuffer | Uint8Array<ArrayBuffer>, poll: RecountPoll, published: Published): Promise<RecountOutcome> {
  const sha256 = await sha256Hex(bytes);
  const [header = [], ...rows] = parseCsv(new TextDecoder().decode(bytes));
  const rules = pollRules({ presetId: poll.presetId, seats: poll.seats, maxRanks: poll.maxRanks }, sha256);
  const result = tabulate({
    candidates: poll.options.map((label) => ({ id: label, name: label })),
    ballots: patternsFromRows(rows),
    rules,
  });
  const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
  return {
    ballots: rows.length,
    columns: header.length,
    sha256,
    hashMatches: sha256 === published.sha256,
    winners: result.winners,
    rounds: result.rounds.length,
    countMatches: same(result.winners, published.winners) && result.rounds.length === published.rounds,
  };
}
