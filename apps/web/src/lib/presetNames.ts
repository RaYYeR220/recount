import { PRESETS, type PresetId } from "@recount/engine";

export type PresetName = {
  id: PresetId;
  /** What the rules select shows, e.g. "New York City". */
  label: string;
  /** One plain sentence on what the rules do differently. */
  description: string;
};

/** Every engine preset, in the order the count tool lists them. */
export const PRESET_NAMES: readonly PresetName[] = [
  {
    id: "recount-standard",
    label: "Recount standard",
    description: "An overvoted rank is skipped, every rank counts, and a tie goes to the previous round's counts, then a seeded draw.",
  },
  {
    id: "nyc",
    label: "New York City",
    description: "An overvote ends the ballot. Five rankings, write-ins out first, hopeless candidates out together, counted down to the final two.",
  },
  {
    id: "minneapolis-irv",
    label: "Minneapolis",
    description: "An overvoted rank is skipped. Three rankings, the threshold is fixed after round 1, hopeless candidates out together.",
  },
  {
    id: "minneapolis-stv",
    label: "Minneapolis, several seats",
    description: "Single transferable vote: an overvoted rank is skipped, three rankings, surpluses wait while hopeless candidates go out.",
  },
  {
    id: "portland-stv",
    label: "Portland",
    description: "Single transferable vote: an overvoted rank is skipped, six rankings, write-ins out first, surpluses move at four decimal places.",
  },
  {
    id: "alaska",
    label: "Alaska",
    description: "An overvote ends the ballot, two skipped rankings in a row end it, four rankings, a repeated name is passed over.",
  },
  {
    id: "burlington-2009",
    label: "Burlington 2009",
    description: "An overvote ends the ballot. Five rankings, hopeless candidates out together.",
  },
];

const BY_ID = new Map(PRESET_NAMES.map((p) => [p.id, p]));

export function isPresetId(id: string): id is PresetId {
  return Object.hasOwn(PRESETS, id);
}

/** "New York City" for "nyc"; the id itself for anything unknown. */
export function presetLabel(id: string): string {
  return BY_ID.get(id as PresetId)?.label ?? id;
}

export function presetName(id: PresetId): PresetName {
  return BY_ID.get(id)!;
}
