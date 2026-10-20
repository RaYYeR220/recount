import { PRESETS } from "@recount/engine";
import { describe, expect, it } from "vitest";
import { createPollSchema, MULTI_WINNER_ONLY, PRESET_IDS } from "@/server/polls/schema";
import { pollInput } from "./factories";

describe("poll presets", () => {
  it("are all engine presets", () => {
    for (const id of PRESET_IDS) expect(Object.keys(PRESETS)).toContain(id);
  });

  it("require two seats exactly when the engine preset is multi-winner by definition", () => {
    const multiWinner = PRESET_IDS.filter((id) => {
      const mode = PRESETS[id].winnerElectionMode;
      return mode !== undefined && mode !== "singleWinnerMajority";
    });
    expect(multiWinner).toEqual(MULTI_WINNER_ONLY);
  });
});

describe("option labels", () => {
  it.each(["exhausted", "residualSurplus", "__proto__"])("reject %s, which the engine reserves", (label) => {
    const result = createPollSchema.safeParse(pollInput({ options: [label, "Pizza", "Tacos"] }));
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["options", 0]);
  });
});
