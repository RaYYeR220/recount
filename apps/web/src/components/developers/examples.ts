import { lunchRequest } from "@/components/landing/apiExample";
import { compactJson } from "@/lib/compactJson";
import type { CreatePollInput } from "@/server/polls/schema";
import type { Operation } from "./operations";

/** A real, valid body for POST /api/v1/polls. */
export const CREATE_POLL_EXAMPLE: CreatePollInput = {
  title: "Team lunch",
  options: ["Pizza", "Tacos", "Sushi"],
  seats: 1,
  presetId: "recount-standard",
  maxRanks: null,
  accessMode: "link",
  resultsVisibility: "live",
  timeZone: "Europe/Warsaw",
  opensAtLocal: null,
  closesAtLocal: "2027-01-15T12:00",
};

/** Seeded polls the examples point at, so every read example answers for real. */
const EXAMPLE_PARAMS: Record<string, Record<string, string>> = {
  getElection: { slug: "nyc-2025-dem-mayor" },
  getPoll: { slug: "lunch-closed" },
  getPollResults: { slug: "lunch-closed" },
  getPollCvr: { slug: "lunch-closed" },
  closePoll: { slug: "$POLL_SLUG" },
};

const EXAMPLE_QUERY: Record<string, string> = {
  getPollCvr: "?format=csv",
};

/** /polls/{slug} with the example's own values filled in. */
export function examplePath(op: Operation): string {
  const params = EXAMPLE_PARAMS[op.operationId] ?? {};
  return op.url.replace(/\{(\w+)\}/g, (_, name: string) => params[name] ?? `{${name}}`) + (EXAMPLE_QUERY[op.operationId] ?? "");
}

function body(op: Operation): unknown | null {
  if (op.operationId === "tabulate") {
    const { contest, candidates, ballots } = lunchRequest();
    return { contest, candidates, ballots };
  }
  if (op.operationId === "createPoll") return CREATE_POLL_EXAMPLE;
  return null;
}

/**
 * The curl line for an operation against `base` (this site's origin, or
 * "$RECOUNT_URL" before it is known). The same number of lines either way, so the
 * block never changes height when the origin streams in.
 */
export function curlFor(op: Operation, base: string): string {
  const url = `${base}${examplePath(op)}`;
  const lines = [op.method === "get" ? `curl "${url}"` : `curl -X ${op.method.toUpperCase()} "${url}"`];
  if (op.auth === "required") lines.push('-H "Authorization: Bearer $RECOUNT_TOKEN"');
  const data = body(op);
  if (data !== null) {
    lines.push('-H "Content-Type: application/json"');
    lines.push(`-d '${compactJson(data, 58).replace(/\n/g, "\n  ")}'`);
  }
  return lines.join(" \\\n  ");
}
