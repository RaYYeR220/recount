import { assertCandidateId, type PresetId as EnginePresetId } from "@recount/engine";
import { z } from "zod";
import { isLocalDateTime, isValidTimeZone } from "../time";
import type { Issue } from "../validation";

/** The engine presets an organizer may pick; the replay-only ones stay out. */
export const PRESET_IDS = [
  "recount-standard",
  "nyc",
  "minneapolis-irv",
  "portland-stv",
] as const satisfies readonly EnginePresetId[];
export type PresetId = (typeof PRESET_IDS)[number];

export const SINGLE_WINNER_ONLY: readonly PresetId[] = ["nyc", "minneapolis-irv"];
export const MULTI_WINNER_ONLY: readonly PresetId[] = ["portland-stv"];

function isUsableLabel(label: string): boolean {
  try {
    assertCandidateId(label);
    return true;
  } catch {
    return false;
  }
}

/** Spreadsheets run a cell that starts like this as a formula, and the CVR is opened in them. */
const FORMULA_START = /^[=+\-@\t\r]/;

const optionLabel = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .refine(isUsableLabel, "This option name is reserved, pick another")
  .refine((label) => !FORMULA_START.test(label), "Start the name with something other than =, +, - or @");

const localDateTime = z
  .string()
  .refine(isLocalDateTime, "Use the format YYYY-MM-DDTHH:mm")
  .describe("Wall-clock time YYYY-MM-DDTHH:mm in the poll's time zone");

const pollFields = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(2000),
  options: z.array(optionLabel).min(2).max(30),
  seats: z.number().int().min(1).max(29),
  presetId: z.enum(PRESET_IDS),
  maxRanks: z.number().int().min(1).max(30).nullable(),
  accessMode: z.enum(["link", "codes"]),
  resultsVisibility: z.enum(["live", "after_close", "owner_only"]),
  timeZone: z
    .string()
    .refine(isValidTimeZone, "Unknown time zone")
    .describe("IANA time zone, for example Europe/Warsaw"),
  opensAtLocal: localDateTime.nullable(),
  closesAtLocal: localDateTime.nullable(),
});

export type BallotShape = {
  options: string[];
  seats: number;
  presetId: PresetId;
  maxRanks: number | null;
};

export function ballotShapeIssues(shape: BallotShape): Issue[] {
  const issues: Issue[] = [];
  const count = shape.options.length;
  if (new Set(shape.options.map((o) => o.trim().toLowerCase())).size !== count) {
    issues.push({ path: "options", message: "Option labels must be unique" });
  }
  if (shape.seats > count - 1) {
    issues.push({ path: "seats", message: "There must be more options than seats" });
  }
  if (shape.maxRanks !== null && shape.maxRanks > count) {
    issues.push({ path: "maxRanks", message: "Voters cannot rank more choices than there are options" });
  }
  if (SINGLE_WINNER_ONLY.includes(shape.presetId) && shape.seats !== 1) {
    issues.push({ path: "presetId", message: "This preset elects a single winner" });
  }
  if (MULTI_WINNER_ONLY.includes(shape.presetId) && shape.seats < 2) {
    issues.push({ path: "presetId", message: "This preset needs at least two seats" });
  }
  return issues;
}

export const createPollSchema = pollFields
  .extend({ description: pollFields.shape.description.optional() })
  .superRefine((value, ctx) => {
    for (const { path, message } of ballotShapeIssues(value)) {
      ctx.addIssue({ code: "custom", path: [path], message });
    }
  });

export const updatePollSchema = pollFields.partial();

export type CreatePollInput = z.input<typeof createPollSchema>;
export type UpdatePollInput = z.input<typeof updatePollSchema>;
