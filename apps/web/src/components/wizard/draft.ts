import { presetFits, presetInfo, type AccessMode, type ResultsVisibility } from "@/lib/pollText";
import { parseWallInput } from "@/lib/when";
import type { CreatePollInput, PresetId } from "@/server/polls/schema";

/** The new-poll wizard's state: what the organizer has typed so far, as typed. */
export type Draft = {
  title: string;
  description: string;
  /** Each option keeps its key while others are added and removed. */
  options: Array<{ key: number; label: string }>;
  winners: "one" | "many";
  seats: string;
  presetId: PresetId;
  maxRanks: number | null;
  accessMode: AccessMode;
  resultsVisibility: ResultsVisibility;
  /** Empty until the organizer picks one; the browser's zone stands in. */
  timeZone: string;
  openMode: "now" | "at";
  opensText: string;
  closesText: string;
};

export const STEPS = ["Options", "Method and seats", "Rules", "Access and results", "Schedule", "Review"] as const;
export const REVIEW_STEP = STEPS.length - 1;

export const MAX_OPTIONS = 30;
export const MAX_OPTION_LENGTH = 80;
export const MAX_TITLE_LENGTH = 120;
export const MAX_DESCRIPTION_LENGTH = 2000;

export function emptyDraft(): Draft {
  return {
    title: "",
    description: "",
    options: [
      { key: 1, label: "" },
      { key: 2, label: "" },
      { key: 3, label: "" },
    ],
    winners: "one",
    seats: "2",
    presetId: "recount-standard",
    maxRanks: null,
    accessMode: "link",
    resultsVisibility: "live",
    timeZone: "",
    openMode: "now",
    opensText: "",
    closesText: "",
  };
}

/** Option labels as they will be saved: trimmed, blanks left out. */
export function optionLabels(draft: Draft): string[] {
  return draft.options.map((o) => o.label.trim()).filter((label) => label !== "");
}

export function seatCount(draft: Draft): number {
  if (draft.winners === "one") return 1;
  const n = Number(draft.seats);
  return Number.isInteger(n) ? n : NaN;
}

export type DraftIssue = { field: string; message: string };

const FORMAT_HINT = "Use the format YYYY-MM-DD HH:mm, for example 2027-03-14 09:00.";

/** What stops a step from being finished, in words for the organizer. Empty when it is done. */
export function stepIssues(draft: Draft, step: number): DraftIssue[] {
  const issues: DraftIssue[] = [];
  const add = (field: string, message: string) => issues.push({ field, message });
  const labels = optionLabels(draft);

  if (step === 0) {
    const title = draft.title.trim();
    if (title.length < 3) add("title", "Give the poll a title of at least 3 characters.");
    else if (title.length > MAX_TITLE_LENGTH) add("title", `Keep the title to ${MAX_TITLE_LENGTH} characters.`);
    if (draft.description.trim().length > MAX_DESCRIPTION_LENGTH) {
      add("description", `Keep the description to ${MAX_DESCRIPTION_LENGTH.toLocaleString("en-US")} characters.`);
    }
    if (labels.length < 2) add("options", "Add at least two options.");
    if (labels.length > MAX_OPTIONS) add("options", `A poll can have at most ${MAX_OPTIONS} options.`);
    const long = labels.find((l) => l.length > MAX_OPTION_LENGTH);
    if (long) add("options", `Keep each option to ${MAX_OPTION_LENGTH} characters.`);
    const seen = new Set<string>();
    for (const label of labels) {
      const key = label.toLowerCase();
      if (seen.has(key)) {
        add("options", `Two options are both called “${label}”. Give each one its own name.`);
        break;
      }
      seen.add(key);
    }
  }

  if (step === 1 && draft.winners === "many") {
    const seats = seatCount(draft);
    const most = labels.length - 1;
    if (most < 2) add("seats", "Several winners need at least three options. Add options, or choose one winner.");
    else if (!Number.isInteger(seats) || seats < 2) add("seats", "Fill at least 2 seats, or choose one winner.");
    else if (seats > most) add("seats", `With ${labels.length} options you can fill at most ${most} seats.`);
  }

  if (step === 2) {
    const preset = presetInfo(draft.presetId);
    const fits = preset ? presetFits(preset, seatCount(draft)) : null;
    if (fits && !fits.ok) add("presetId", `${preset!.name} rules are ${fits.reason.toLowerCase()}. Pick another set.`);
    if (draft.maxRanks !== null && draft.maxRanks > labels.length) add("maxRanks", "Voters can't rank more options than there are.");
  }

  if (step === 4) {
    if (draft.openMode === "at") {
      if (draft.opensText.trim() === "") add("opens", "Enter when voting opens.");
      else if (!parseWallInput(draft.opensText)) add("opens", FORMAT_HINT);
    }
    if (draft.closesText.trim() !== "" && !parseWallInput(draft.closesText)) add("closes", FORMAT_HINT);
  }

  return issues;
}

/** The first step that isn't finished, or the review step when they all are. */
export function firstOpenStep(draft: Draft): number {
  for (let step = 0; step < REVIEW_STEP; step++) {
    if (stepIssues(draft, step).length > 0) return step;
  }
  return REVIEW_STEP;
}

/** The draft as createPoll takes it. Only meaningful once the steps are finished. */
export function toCreateInput(draft: Draft, timeZone: string): CreatePollInput {
  const description = draft.description.trim();
  return {
    title: draft.title.trim(),
    ...(description ? { description } : {}),
    options: optionLabels(draft),
    seats: seatCount(draft),
    presetId: draft.presetId,
    maxRanks: draft.maxRanks,
    accessMode: draft.accessMode,
    resultsVisibility: draft.resultsVisibility,
    timeZone,
    opensAtLocal: draft.openMode === "at" ? parseWallInput(draft.opensText) : null,
    closesAtLocal: draft.closesText.trim() ? parseWallInput(draft.closesText) : null,
  };
}

/** The step a server validation path belongs to. */
export function stepOfPath(path: string): number {
  const field = path.split(".")[0];
  if (field === "title" || field === "description" || field === "options") return 0;
  if (field === "seats") return 1;
  if (field === "presetId" || field === "maxRanks") return 2;
  if (field === "accessMode" || field === "resultsVisibility") return 3;
  return 4;
}

/** Splits pasted text into option labels, one per line. */
export function splitPasted(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim())
    .filter((line) => line !== "");
}
