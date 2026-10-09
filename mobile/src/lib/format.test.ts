import { describe, expect, it } from "vitest";

import { compactCount, greeting, plural } from "./format";

describe("format", () => {
  it("compacts impact numbers like the web", () => {
    expect(compactCount(2_493_428)).toBe("2.5M");
    expect(compactCount(38_400)).toBe("38k");
    expect(compactCount(999)).toBe("999");
  });

  it("greets in te reo by time of day", () => {
    expect(greeting(new Date(2026, 9, 9, 8))).toBe("Mōrena");
    expect(greeting(new Date(2026, 9, 9, 15))).toBe("Kia ora");
  });

  it("pluralises", () => {
    expect(plural(1, "shift", "shifts")).toBe("1 shift");
    expect(plural(3, "shift", "shifts")).toBe("3 shifts");
  });
});
