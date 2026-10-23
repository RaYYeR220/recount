import { describe, expect, it } from "vitest";
import {
  emptyDraft,
  firstOpenStep,
  pasteOptions,
  REVIEW_STEP,
  splitPasted,
  stepIssues,
  stepOfPath,
  toCreateInput,
  type Draft,
} from "@/components/wizard/draft";
import { createPollSchema } from "@/server/polls/schema";

function draft(patch: Partial<Draft> = {}): Draft {
  return {
    ...emptyDraft(),
    title: "Spring offsite",
    options: ["Lisbon", "Kraków", "Tallinn"].map((label, i) => ({ key: i + 1, label })),
    ...patch,
  };
}

const fields = (d: Draft, step: number) => stepIssues(d, step).map((i) => i.field);

describe("new poll draft", () => {
  it("starts at the first step and reaches review once everything is filled in", () => {
    expect(firstOpenStep(emptyDraft())).toBe(0);
    expect(firstOpenStep(draft())).toBe(REVIEW_STEP);
  });

  it("asks for a title and two distinct options, ignoring blank rows", () => {
    expect(fields(draft({ title: "Hi" }), 0)).toEqual(["title"]);
    const blanks = draft({ options: [{ key: 1, label: "Lisbon" }, { key: 2, label: "  " }, { key: 3, label: "" }] });
    expect(stepIssues(blanks, 0)).toEqual([{ field: "options", message: "Add at least two options." }]);
    const twins = draft({ options: [{ key: 1, label: "Lisbon" }, { key: 2, label: "lisbon " }] });
    expect(stepIssues(twins, 0)[0]?.message).toBe("Two options are both called “lisbon”. Give each one its own name.");
  });

  it("needs fewer seats than options", () => {
    expect(fields(draft({ winners: "many", seats: "2" }), 1)).toEqual([]);
    expect(stepIssues(draft({ winners: "many", seats: "3" }), 1)[0]?.message).toBe("With 3 options you can fill at most 2 seats.");
    expect(fields(draft({ winners: "many", seats: "1" }), 1)).toEqual(["seats"]);
    expect(fields(draft({ winners: "many", seats: "two" }), 1)).toEqual(["seats"]);
  });

  it("keeps the rules preset to the seats it can count", () => {
    expect(fields(draft({ presetId: "nyc" }), 2)).toEqual([]);
    expect(fields(draft({ presetId: "portland-stv" }), 2)).toEqual(["presetId"]);
    expect(fields(draft({ presetId: "nyc", winners: "many", seats: "2" }), 2)).toEqual(["presetId"]);
    expect(fields(draft({ maxRanks: 4 }), 2)).toEqual(["maxRanks"]);
  });

  it("checks the typed times' format, not their meaning", () => {
    expect(fields(draft({ openMode: "at", opensText: "" }), 4)).toEqual(["opens"]);
    expect(fields(draft({ openMode: "at", opensText: "14/03/2027 02:30" }), 4)).toEqual(["opens"]);
    expect(fields(draft({ openMode: "at", opensText: "2027-03-14 02:30", closesText: "soon" }), 4)).toEqual(["closes"]);
    expect(fields(draft({ openMode: "now", opensText: "junk", closesText: "" }), 4)).toEqual([]);
  });

  it("turns into input createPoll accepts", () => {
    const input = toCreateInput(
      draft({ description: "  ", openMode: "at", opensText: "2027-03-14 02:30", closesText: "2027-03-21 18:00", presetId: "nyc", maxRanks: 2 }),
      "America/New_York",
    );
    expect(input).toEqual({
      title: "Spring offsite",
      options: ["Lisbon", "Kraków", "Tallinn"],
      seats: 1,
      presetId: "nyc",
      maxRanks: 2,
      accessMode: "link",
      resultsVisibility: "live",
      timeZone: "America/New_York",
      opensAtLocal: "2027-03-14T02:30",
      closesAtLocal: "2027-03-21T18:00",
    });
    expect(createPollSchema.safeParse(input).success).toBe(true);
    expect(toCreateInput(draft({ openMode: "now", opensText: "2027-03-14 02:30" }), "UTC").opensAtLocal).toBeNull();
  });

  it("sends a server error back to the step it belongs to", () => {
    expect(["title", "options.2", "seats", "maxRanks", "resultsVisibility", "closesAtLocal", ""].map(stepOfPath)).toEqual([0, 0, 1, 2, 3, 4, 4]);
  });

  it("splits a pasted list into options, dropping bullets and blank lines", () => {
    expect(splitPasted("- Lisbon\r\n\n2. Kraków\n• Tallinn  \n")).toEqual(["Lisbon", "Kraków", "Tallinn"]);
  });

  it("pastes a list into the rows, leaving no blank rows under it", () => {
    const pasted = pasteOptions(emptyDraft().options, 0, ["Lisbon", "Kraków", "Tallinn", "Valencia"]);
    expect(pasted.map((o) => o.label)).toEqual(["Lisbon", "Kraków", "Tallinn", "Valencia"]);
    expect(new Set(pasted.map((o) => o.key)).size).toBe(4);
    const rows = [{ key: 1, label: "Porto" }, { key: 2, label: "" }, { key: 3, label: "" }, { key: 4, label: "Riga" }];
    expect(pasteOptions(rows, 1, ["Lisbon", "Kraków"]).map((o) => o.label)).toEqual(["Porto", "Lisbon", "Kraków", "Riga"]);
  });

  it("keeps a pasted list to the most options a poll can have", () => {
    const lines = Array.from({ length: 40 }, (_, i) => `City ${i + 1}`);
    expect(pasteOptions(emptyDraft().options, 0, lines)).toHaveLength(30);
  });
});
