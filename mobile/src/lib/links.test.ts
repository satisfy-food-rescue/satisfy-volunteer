import { describe, expect, it } from "vitest";

import { routeForWebPath, TAB } from "./links";

describe("routeForWebPath", () => {
  it("maps shift links from push notifications to the shift screen", () => {
    expect(routeForWebPath("/app/shifts/cm123")).toEqual({ pathname: "/shift/[id]", params: { id: "cm123" } });
  });

  it("accepts absolute URLs, query strings and trailing slashes", () => {
    expect(routeForWebPath("https://volunteers.example.org/app/shifts/cm123/?from=email#top")).toEqual({ pathname: "/shift/[id]", params: { id: "cm123" } });
  });

  it("maps each volunteer section to its tab or screen", () => {
    expect(routeForWebPath("/app")).toBe(TAB.home);
    expect(routeForWebPath("/app/shifts")).toBe(TAB.shifts);
    expect(routeForWebPath("/app/gaps")).toBe(TAB.cover);
    expect(routeForWebPath("/app/training")).toBe(TAB.training);
    expect(routeForWebPath("/app/training/MANUAL_HANDLING")).toEqual({ pathname: "/module/[code]", params: { code: "MANUAL_HANDLING" } });
    expect(routeForWebPath("/app/slot")).toBe("/slot");
    expect(routeForWebPath("/app/harvest")).toBe("/harvest");
    expect(routeForWebPath("/app/profile")).toBe(TAB.me);
  });

  it("sends anything else home", () => {
    expect(routeForWebPath(undefined)).toBe(TAB.home);
    expect(routeForWebPath("")).toBe(TAB.home);
    expect(routeForWebPath("/admin/roster")).toBe(TAB.home);
    expect(routeForWebPath("/app/unknown")).toBe(TAB.home);
  });
});
