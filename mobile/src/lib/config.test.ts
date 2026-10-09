import { describe, expect, it, vi } from "vitest";

vi.mock("expo-constants", () => ({ default: { expoConfig: null } }));

const { resolveApiUrl } = await import("./config");

describe("resolveApiUrl", () => {
  it("uses the configured URL without a trailing slash", () => {
    expect(resolveApiUrl("https://volunteers.example.org/", "192.168.1.20:8081")).toBe("https://volunteers.example.org");
  });

  it("falls back to the Metro host on port 3000 in development", () => {
    expect(resolveApiUrl(undefined, "192.168.1.20:8081")).toBe("http://192.168.1.20:3000");
    expect(resolveApiUrl(undefined, "exp://10.0.0.5:8081/--/")).toBe("http://10.0.0.5:3000");
  });

  it("falls back to localhost when there is no Metro host", () => {
    expect(resolveApiUrl(undefined, undefined)).toBe("http://localhost:3000");
  });
});
