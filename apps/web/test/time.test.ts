import { describe, expect, it } from "vitest";
import { isLocalDateTime, isValidTimeZone, resolveLocal } from "@/server/time";

describe("resolveLocal", () => {
  it("shifts a wall time inside a DST gap forward and says so", () => {
    const { instant, warning } = resolveLocal("2026-03-08T02:30", "America/New_York");
    expect(instant.toISOString()).toBe("2026-03-08T07:30:00.000Z");
    expect(warning).toBe("dst_gap_shifted");
  });

  it("takes the earlier instant of a repeated wall time and says so", () => {
    const { instant, warning } = resolveLocal("2026-11-01T01:30", "America/New_York");
    expect(instant.toISOString()).toBe("2026-11-01T05:30:00.000Z");
    expect(warning).toBe("dst_overlap_earlier");
  });

  it("resolves an ordinary wall time without a warning", () => {
    const { instant, warning } = resolveLocal("2026-07-01T12:00", "Europe/Warsaw");
    expect(instant.toISOString()).toBe("2026-07-01T10:00:00.000Z");
    expect(warning).toBeNull();
  });

  it("treats UTC as a zone without transitions", () => {
    expect(resolveLocal("2026-03-29T02:30", "UTC")).toEqual({
      instant: new Date("2026-03-29T02:30:00Z"),
      warning: null,
    });
  });
});

describe("isValidTimeZone", () => {
  it.each(["UTC", "Europe/Warsaw", "America/New_York", "Asia/Kolkata"])("accepts %s", (zone) => {
    expect(isValidTimeZone(zone)).toBe(true);
  });

  it.each(["Mars/Olympus", "", "utc+2", "Europe"])("rejects %j", (zone) => {
    expect(isValidTimeZone(zone)).toBe(false);
  });
});

describe("isLocalDateTime", () => {
  it.each(["2026-07-01T12:00", "2028-02-29T23:59"])("accepts %s", (value) => {
    expect(isLocalDateTime(value)).toBe(true);
  });

  it.each(["2026-07-01 12:00", "2026-07-01T12:00:00", "2026-02-30T10:00", "2026-13-01T10:00", "2026-07-01T24:00"])(
    "rejects %s",
    (value) => {
      expect(isLocalDateTime(value)).toBe(false);
    },
  );
});
