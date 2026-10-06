import { describe, expect, it } from "vitest";
import { postSignInPath, safeNextPath } from "@/lib/auth-shared";

describe("safeNextPath", () => {
  it("keeps same-origin paths", () => {
    expect(safeNextPath("/app/shifts/abc")).toBe("/app/shifts/abc");
    expect(safeNextPath("/admin/roster?week=2026-10-05")).toBe("/admin/roster?week=2026-10-05");
  });

  it.each([null, undefined, "", "app", "https://evil.example", "//evil.example", "/\\evil.example", "/\\/evil.example", "/\t/evil.example", "/\n/evil.example", "/\r//evil.example", "/%2F/evil.example".replace("%2F", "/")])(
    "rejects %s",
    (next) => {
      expect(safeNextPath(next)).toBeNull();
    },
  );
});

describe("postSignInPath", () => {
  it("sends people home without a destination", () => {
    expect(postSignInPath("ADMIN", null)).toBe("/admin");
    expect(postSignInPath("VOLUNTEER", undefined)).toBe("/app");
  });

  it("honours a safe destination", () => {
    expect(postSignInPath("VOLUNTEER", "/app/training")).toBe("/app/training");
    expect(postSignInPath("ADMIN", "/admin/volunteers/x")).toBe("/admin/volunteers/x");
    expect(postSignInPath("ADMIN", "/app/shifts/y")).toBe("/app/shifts/y");
  });

  it("never sends a volunteer into the coordinator area", () => {
    expect(postSignInPath("VOLUNTEER", "/admin/outbox")).toBe("/app");
  });

  it("ignores an unsafe destination", () => {
    expect(postSignInPath("VOLUNTEER", "//evil.example")).toBe("/app");
  });
});
