import { describe, expect, it } from "vitest";
import { addDays, addMonths, daysBetween, formatTime, formatTimeRange, nzInstant, todayISO, weekdayOf, weekMonday } from "@/lib/dates";

describe("calendar arithmetic", () => {
  it("adds days across month and year ends", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("clamps addMonths to the end of shorter months", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-10-15", 12)).toBe("2027-10-15");
    expect(addMonths("2026-10-15", -12)).toBe("2025-10-15");
  });

  it("counts days between dates", () => {
    expect(daysBetween("2026-10-02", "2026-11-01")).toBe(30);
    expect(daysBetween("2026-10-02", "2026-09-25")).toBe(-7);
  });

  it("uses ISO weekdays with Monday as 1", () => {
    expect(weekdayOf("2026-10-05")).toBe(1);
    expect(weekdayOf("2026-10-04")).toBe(7);
    expect(weekMonday("2026-10-04")).toBe("2026-09-28");
  });
});

describe("New Zealand time", () => {
  it("reads today in Pacific/Auckland, not UTC", () => {
    // 11pm UTC on 1 Oct is already 2 Oct in New Zealand (NZDT, UTC+13).
    expect(todayISO(new Date("2026-10-01T23:00:00Z"))).toBe("2026-10-02");
  });

  it("builds instants on both sides of daylight saving", () => {
    // NZST (UTC+12) in winter, NZDT (UTC+13) in summer.
    expect(nzInstant("2026-07-01", "09:00").toISOString()).toBe("2026-06-30T21:00:00.000Z");
    expect(nzInstant("2026-12-01", "09:00").toISOString()).toBe("2026-11-30T20:00:00.000Z");
  });

  it("formats wall-clock times", () => {
    expect(formatTime("09:00")).toBe("9am");
    expect(formatTime("12:30")).toBe("12:30pm");
    expect(formatTimeRange("08:00", "11:30")).toBe("8am - 11:30am");
  });
});
