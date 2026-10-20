/**
 * The count tool's ballot format, one ballot per line:
 *
 *   Pizza,Tacos,Sushi      ranks in order, comma-separated
 *   Pizza|Tacos,Sushi      two names at one rank: an overvote at that rank
 *   Pizza,,Sushi           an empty field: rank 2 skipped
 *   Tacos,Pizza x3         a trailing "x" and a number: three identical ballots
 *   "Peltola, Mary S."     quotes around a name that contains a comma or a |
 *   # a comment            ignored, like blank lines
 *
 * Candidates are the names in the order they first appear. Errors carry the line
 * number so they can be fixed in place.
 */
import { assertCandidateId, type BallotPattern } from "@recount/engine";
import { formatCount } from "./votes";

export const MAX_BALLOT_LINES = 100_000;
export const MAX_CANDIDATES = 1_000;
export const MAX_NAME_LENGTH = 200;
const MAX_COUNT = 1_000_000_000;

export type BallotCsvError = { line: number; message: string };

export type ParsedBallots = {
  /** Names in order of first appearance. */
  candidates: string[];
  /** Identical rankings merged, in order of first appearance. */
  ballots: BallotPattern[];
  totalBallots: number;
  errors: BallotCsvError[];
};

type Segment = { text: string; quoted: boolean };

const COUNT_SUFFIX = /^(.*?)\s+[x×](\d+)\s*$/i;
const BAD_COUNT_SUFFIX = /\s[x×](\d*[.,]\d*|-\d+)\s*$/i;

function isReserved(name: string): boolean {
  try {
    assertCandidateId(name);
    return false;
  } catch {
    return true;
  }
}

/** Fields of one line, each split into its `|` segments. Throws a message on an unclosed quote. */
function tokenize(line: string): Segment[][] {
  const fields: Segment[][] = [];
  let segments: Segment[] = [];
  let text = "";
  let quoted = false;
  let inQuotes = false;
  const endSegment = () => {
    segments.push({ text: quoted ? text : text.trim(), quoted });
    text = "";
    quoted = false;
  };
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        text += '"';
        i++;
      } else if (ch === '"') inQuotes = false;
      else text += ch;
    } else if (ch === '"' && text.trim() === "" && !quoted) {
      inQuotes = true;
      quoted = true;
      text = "";
    } else if (ch === "|") endSegment();
    else if (ch === ",") {
      endSegment();
      fields.push(segments);
      segments = [];
    } else if (quoted) {
      if (ch.trim() !== "") throw new Error("put the closing quote at the end of the name");
    } else text += ch;
  }
  if (inQuotes) throw new Error("a quote is opened but never closed");
  endSegment();
  fields.push(segments);
  return fields;
}

export function parseBallotCsv(input: string): ParsedBallots {
  const errors: BallotCsvError[] = [];
  const candidates: string[] = [];
  const known = new Set<string>();
  const patterns = new Map<string, BallotPattern & { count: number }>();
  let totalBallots = 0;
  let ballotLines = 0;

  const lines = input.split(/\r\n|\n|\r/);
  for (let index = 0; index < lines.length; index++) {
    const lineNo = index + 1;
    const raw = lines[index]!;
    const trimmed = raw.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    const fail = (message: string) => errors.push({ line: lineNo, message });

    ballotLines++;
    if (ballotLines > MAX_BALLOT_LINES) {
      fail(`only ${formatCount(MAX_BALLOT_LINES)} ballot lines fit in one count; add an "x" count to repeated ballots instead`);
      break;
    }

    let body = trimmed;
    let count = 1;
    const suffix = COUNT_SUFFIX.exec(trimmed);
    if (suffix) {
      body = suffix[1]!;
      count = Number(suffix[2]);
      if (count < 1 || count > MAX_COUNT) {
        fail(`the count after "x" must be from 1 to ${formatCount(MAX_COUNT)}`);
        continue;
      }
    } else if (BAD_COUNT_SUFFIX.test(trimmed)) {
      fail('the count after "x" must be a whole number, like x3');
      continue;
    }

    let fields: Segment[][];
    try {
      fields = tokenize(body);
    } catch (error) {
      fail((error as Error).message);
      continue;
    }

    const ranking: string[][] = [];
    let lineOk = true;
    fields.forEach((segments, r) => {
      if (!lineOk) return;
      const rank = r + 1;
      if (segments.length === 1 && !segments[0]!.quoted && segments[0]!.text === "") {
        ranking.push([]);
        return;
      }
      const slot: string[] = [];
      for (const { text } of segments) {
        if (text === "") {
          fail(segments.length > 1 ? `rank ${rank} has an empty name next to "|"; put a name on both sides` : `rank ${rank} has an empty name in quotes`);
          lineOk = false;
          return;
        }
        if (text.length > MAX_NAME_LENGTH) {
          fail(`rank ${rank} has a name longer than ${MAX_NAME_LENGTH} characters`);
          lineOk = false;
          return;
        }
        if (isReserved(text)) {
          fail(`"${text}" is a reserved word in the count; give this candidate another name`);
          lineOk = false;
          return;
        }
        if (slot.includes(text)) {
          fail(`rank ${rank} marks ${text} twice; an overvote needs two different names`);
          lineOk = false;
          return;
        }
        slot.push(text);
      }
      ranking.push(slot);
    });
    if (!lineOk) continue;

    while (ranking.length > 0 && ranking.at(-1)!.length === 0) ranking.pop();

    const fresh = ranking.flat().filter((name) => !known.has(name));
    if (known.size + new Set(fresh).size > MAX_CANDIDATES) {
      fail(`a count holds at most ${formatCount(MAX_CANDIDATES)} candidates`);
      break;
    }
    for (const name of fresh) {
      if (known.has(name)) continue;
      known.add(name);
      candidates.push(name);
    }

    const key = JSON.stringify(ranking);
    const pattern = patterns.get(key);
    if (pattern) pattern.count += count;
    else patterns.set(key, { ranking, count });
    totalBallots += count;
  }

  if (errors.length === 0 && totalBallots === 0) errors.push({ line: 0, message: "paste at least one ballot" });
  return { candidates, ballots: [...patterns.values()], totalBallots, errors };
}

/** "Line 3: …", or the bare message for errors about the whole input. */
export function formatBallotError(error: BallotCsvError): string {
  const message = error.message.charAt(0).toUpperCase() + error.message.slice(1);
  return error.line > 0 ? `Line ${error.line}: ${error.message}.` : `${message}.`;
}
