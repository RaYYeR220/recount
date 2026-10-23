import { describe, expect, it } from "vitest";
import { resolveLocal } from "@/server/time";
import {
  formatDay,
  formatTime,
  formatWhen,
  parseWallInput,
  scheduleWarningText,
  wallDay,
  wallInZone,
  wallTime,
  zoneAbbr,
} from "@/lib/when";

const NY = "America/New_York";

describe("parseWallInput", () => {
  it("turns the typed form into the services' form", () => {
    expect(parseWallInput("2027-03-14 02:30")).toBe("2027-03-14T02:30");
    expect(parseWallInput("  2027-01-15 12:00 ")).toBe("2027-01-15T12:00");
  });

  it("takes the services' own form as typed", () => {
    expect(parseWallInput("2027-03-14T02:30")).toBe("2027-03-14T02:30");
    expect(parseWallInput("2027-02-30T10:00")).toBeNull();
  });

  it.each(["2027-03-14  02:30", "2027-3-14 02:30", "2027-02-30 10:00", "2027-13-01 10:00", "2027-01-01 24:00", "2027-01-01 10:60", "tomorrow", ""])(
    "rejects %j",
    (text) => {
      expect(parseWallInput(text)).toBeNull();
    },
  );

  it("knows leap days", () => {
    expect(parseWallInput("2028-02-29 09:00")).toBe("2028-02-29T09:00");
    expect(parseWallInput("2027-02-29 09:00")).toBeNull();
  });
});

describe("formatting in a zone", () => {
  const launch = resolveLocal("2027-01-15T12:00", NY).instant;

  it("prints the poll's wall clock, not the machine's", () => {
    expect(formatWhen(launch, NY)).toBe("January 15, 2027, 12:00 PM");
    expect(formatWhen(launch, "Europe/Warsaw")).toBe("January 15, 2027, 6:00 PM");
    expect(formatWhen(launch, NY, { short: true })).toBe("Jan 15, 2027, 12:00 PM");
    expect(formatDay(launch, NY)).toBe("January 15, 2027");
  });

  it("uses plain spaces before AM and PM", () => {
    expect(formatTime(launch, NY)).toBe("12:00 PM");
    expect(formatWhen(launch, NY)).not.toMatch(/[  ]/);
  });

  it("names the zone's offset for that date", () => {
    expect(zoneAbbr(launch, NY)).toBe("EST");
    expect(zoneAbbr(new Date("2027-07-01T12:00:00Z"), NY)).toBe("EDT");
  });

  it("gives the typed form back", () => {
    expect(wallInZone(launch, NY)).toBe("2027-01-15 12:00");
    expect(wallInZone(new Date("2027-01-01T00:30:00Z"), "Asia/Tokyo")).toBe("2027-01-01 09:30");
  });

  it("reads a wall time as typed", () => {
    expect(wallTime("2027-03-14T02:30")).toBe("2:30 AM");
    expect(wallTime("2027-03-14T00:05")).toBe("12:05 AM");
    expect(wallTime("2027-03-14T12:00")).toBe("12:00 PM");
    expect(wallTime("2027-03-14T23:59")).toBe("11:59 PM");
    expect(wallDay("2027-11-07T01:30")).toBe("November 7, 2027");
  });
});

describe("scheduleWarningText", () => {
  it("explains a time skipped by the spring-forward gap", () => {
    const local = "2027-03-14T02:30";
    const { instant, warning } = resolveLocal(local, NY);
    expect(warning).toBe("dst_gap_shifted");
    expect(scheduleWarningText({ field: "opensAt", code: "dst_gap_shifted" }, local, NY, instant)).toBe(
      "2:30 AM doesn't exist on March 14, 2027 in America/New_York (clocks jump forward). We'll open the poll at 3:30 AM.",
    );
    expect(scheduleWarningText({ field: "closesAt", code: "dst_gap_shifted" }, local, NY, instant)).toBe(
      "2:30 AM doesn't exist on March 14, 2027 in America/New_York (clocks jump forward). We'll close the poll at 3:30 AM.",
    );
  });

  it("explains a time that happens twice when clocks fall back", () => {
    const local = "2027-11-07T01:30";
    const { instant, warning } = resolveLocal(local, NY);
    expect(warning).toBe("dst_overlap_earlier");
    expect(scheduleWarningText({ field: "opensAt", code: "dst_overlap_earlier" }, local, NY, instant)).toBe(
      "1:30 AM happens twice on November 7, 2027 in America/New_York. We'll use the first one (EDT).",
    );
  });

  it("uses the size of the gap in zones where it is not an hour", () => {
    const local = "2027-10-03T02:15";
    const { instant, warning } = resolveLocal(local, "Australia/Lord_Howe");
    expect(warning).toBe("dst_gap_shifted");
    expect(scheduleWarningText({ field: "opensAt", code: "dst_gap_shifted" }, local, "Australia/Lord_Howe", instant)).toContain(
      "We'll open the poll at 2:45 AM.",
    );
  });
});
