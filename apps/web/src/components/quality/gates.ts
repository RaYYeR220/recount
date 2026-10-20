import type { GateName } from "@/lib/quality/verdict";

/** How each gate is named on the page. */
export const GATE_LABEL: Record<GateName, string> = {
  ci: "CI",
  preflight: "Preflight",
  "TestSprite V3": "TestSprite",
};

export function gateLabel(name: string): string {
  return GATE_LABEL[name as GateName] ?? name;
}

/** "ci: results > CVR > orders rows by receipt" → { gate: "CI", test: "results › CVR › orders rows by receipt" } */
export function caughtByTest(entry: string): { gate: string; test: string } {
  const at = entry.indexOf(": ");
  const gate = at > 0 ? entry.slice(0, at) : "";
  const test = (at > 0 ? entry.slice(at + 2) : entry).replace(/ > /g, " › ");
  return { gate: gateLabel(gate), test };
}

/** "a24402d test(web): CVR rows follow receipt order" → the commit and its subject. */
export function fixCommit(fix: string): { sha: string | null; subject: string } {
  const m = /^([0-9a-f]{7,40})\s+(.*)$/.exec(fix);
  return m ? { sha: m[1]!, subject: m[2]! } : { sha: null, subject: fix };
}

export function expectedKillerLabel(expected: string): string {
  return expected === "none" ? "None (the control)" : gateLabel(expected);
}

export const shortDate = (iso: string) =>
  new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
