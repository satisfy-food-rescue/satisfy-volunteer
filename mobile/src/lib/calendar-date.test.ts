import { describe, expect, it } from "vitest";

import { isoToLocalDate, localDateToISO } from "./calendar-date";

describe("calendar dates for native pickers", () => {
  it("round-trips without drifting a day", () => {
    for (const iso of ["2026-01-01", "2026-04-05", "2026-09-27", "2026-12-31"]) {
      expect(localDateToISO(isoToLocalDate(iso))).toBe(iso);
    }
  });

  it("reads the local calendar day, not the UTC one", () => {
    expect(localDateToISO(new Date(2026, 9, 12, 23, 30))).toBe("2026-10-12");
  });
});
