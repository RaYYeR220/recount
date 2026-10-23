import { describe, expect, it } from "vitest";
import { ianaName, zoneChoices } from "@/lib/timeZones";
import { isValidTimeZone, resolveLocal } from "@/server/time";

describe("zoneChoices", () => {
  const choices = zoneChoices(Intl.supportedValuesOf("timeZone"));

  it("lists UTC first, then each zone once by its IANA name", () => {
    expect(choices[0]).toBe("UTC");
    expect(new Set(choices).size).toBe(choices.length);
    expect(choices).toEqual(expect.arrayContaining(["Asia/Kolkata", "Europe/Kyiv", "America/Argentina/Buenos_Aires"]));
    expect(choices).not.toContain("Asia/Calcutta");
    expect(choices).not.toContain("Europe/Kiev");
  });

  it("keeps a zone listed under both names once", () => {
    expect(zoneChoices(["Europe/Kiev", "Europe/Kyiv", "UTC", "Africa/Abidjan"])).toEqual(["UTC", "Africa/Abidjan", "Europe/Kyiv"]);
  });

  it("offers only names the poll services take and can count in", () => {
    for (const zone of choices) {
      expect(isValidTimeZone(zone), zone).toBe(true);
      expect(() => resolveLocal("2027-01-15T12:00", zone), zone).not.toThrow();
    }
  });
});

describe("ianaName", () => {
  it("renames the zones CLDR still calls by their old names, and leaves the rest", () => {
    expect(ianaName("Asia/Calcutta")).toBe("Asia/Kolkata");
    expect(ianaName("Asia/Saigon")).toBe("Asia/Ho_Chi_Minh");
    expect(ianaName("Europe/Warsaw")).toBe("Europe/Warsaw");
  });
});
