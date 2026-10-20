/**
 * Chit colours. Every option gets one chit style from its position on the ballot,
 * so the same option looks the same on the ballot, the legend, the round table and
 * the count table. Ten validated hues; options 11-20 reuse them with a spotted edge,
 * 21-30 with a ringed face. Past 30 the cycle repeats, which is why every chit is
 * always shown next to its option name.
 */

export const CHIT_HUES = [
  { name: "vermilion", hex: "#e4512c" },
  { name: "cerulean", hex: "#0083c4" },
  { name: "amber", hex: "#c28700" },
  { name: "teal", hex: "#04a19b" },
  { name: "rust", hex: "#9c5313" },
  { name: "olive", hex: "#979836" },
  { name: "orchid", hex: "#9f4cb1" },
  { name: "leaf", hex: "#499537" },
  { name: "indigo", hex: "#535ec6" },
  { name: "rose", hex: "#cf5971" },
] as const;

export const CHIT_INLAY = "#f6efdc";
export const CHIT_PALETTE_SIZE = CHIT_HUES.length * 3;

/** 0 plain, 1 spotted edge, 2 ringed face. */
export type ChitTier = 0 | 1 | 2;

export type NeutralChit = "writein" | "inactive" | "exhausted";

/** Either an option's position on the ballot (0-based) or one of the neutral chits. */
export type ChitKey = number | NeutralChit;

export interface ChitStyle {
  key: ChitKey;
  /** Short description, e.g. "vermilion, spotted edge" or "face down". */
  description: string;
  face: string;
  /** Edge band, a darker shade of the face. */
  side: string;
  /** Hairline ring on the face. */
  ring: string;
  inlay: string;
  tier: ChitTier;
  /** Inlay segments around the edge (option chits only). */
  spots: boolean;
  /** Pen stroke on the face (write-ins). */
  pen: boolean;
  /** Turned over: no choices left. */
  faceDown: boolean;
}

function hexToRgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

/** Linear mix of two #rrggbb colours, `t` of the way from `a` to `b`. */
export function mixHex(a: string, b: string, t: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return `#${A.map((v, i) => Math.round(v + (B[i]! - v) * t).toString(16).padStart(2, "0")).join("")}`;
}

const TIER_NAMES = ["", "spotted edge", "ringed face"] as const;

/** Chit style for the option at `index` (0-based ballot position). */
export function optionColour(index: number): ChitStyle {
  if (!Number.isInteger(index) || index < 0) throw new RangeError(`option index must be a whole number >= 0, got ${index}`);
  const cycle = index % CHIT_PALETTE_SIZE;
  const hue = CHIT_HUES[cycle % CHIT_HUES.length]!;
  const tier = Math.floor(cycle / CHIT_HUES.length) as ChitTier;
  return {
    key: index,
    description: tier === 0 ? hue.name : `${hue.name}, ${TIER_NAMES[tier]}`,
    face: hue.hex,
    side: mixHex(hue.hex, "#120a04", 0.42),
    ring: "rgba(0,0,0,.22)",
    inlay: CHIT_INLAY,
    tier,
    spots: true,
    pen: false,
    faceDown: false,
  };
}

export const NEUTRAL_CHITS: Record<NeutralChit, ChitStyle> = {
  writein: {
    key: "writein",
    description: "cream, written on",
    face: "#e9dfc6",
    side: "#b9a983",
    ring: "rgba(80,60,30,.28)",
    inlay: "#8a7a58",
    tier: 0,
    spots: false,
    pen: true,
    faceDown: false,
  },
  inactive: {
    key: "inactive",
    description: "face down",
    face: "#7d776c",
    side: "#4f4a42",
    ring: "rgba(0,0,0,.28)",
    inlay: "#9a948a",
    tier: 0,
    spots: false,
    pen: false,
    faceDown: true,
  },
  exhausted: {
    key: "exhausted",
    description: "face down, no choices left",
    face: "#6b665c",
    side: "#45413a",
    ring: "rgba(0,0,0,.3)",
    inlay: "#8f897e",
    tier: 0,
    spots: false,
    pen: false,
    faceDown: true,
  },
};

export function chitStyle(key: ChitKey): ChitStyle {
  return typeof key === "number" ? optionColour(key) : NEUTRAL_CHITS[key];
}

/** Display names for the neutral chits, as legends and tables label them. */
export const NEUTRAL_LABELS: Record<NeutralChit, string> = {
  writein: "Write-ins",
  inactive: "Inactive",
  exhausted: "Exhausted",
};
