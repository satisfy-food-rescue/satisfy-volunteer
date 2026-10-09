import { describe, expect, it } from "vitest";
import { homeAlert, homeEmpty } from "@/lib/home";

const none = { overdue: 0, notStarted: 0, dueSoon: 0 };
const visit = { startsAt: new Date("2026-10-13T21:30:00Z"), location: "Satisfy warehouse" };

describe("homeAlert", () => {
  it("is null when training is current", () => {
    expect(homeAlert(none, false, null)).toBeNull();
  });
  it("puts overdue first", () => {
    expect(homeAlert({ overdue: 2, notStarted: 1, dueSoon: 1 }, true, visit)).toMatchObject({ tone: "bad", title: "2 training refreshers are overdue" });
    expect(homeAlert({ ...none, overdue: 1 }, false, null)?.title).toBe("1 training refresher is overdue");
  });
  it("shows a booked initial visit in NZ time", () => {
    expect(homeAlert({ ...none, notStarted: 3 }, true, visit)).toEqual({ tone: "info", title: "Your initial visit: Wed 14 Oct, 10:30am", text: "At Satisfy warehouse. Shifts open up once your in-person training is done." });
  });
  it("asks for the initial visit before other training", () => {
    expect(homeAlert({ ...none, notStarted: 3 }, true, null)?.title).toBe("Your initial visit comes first");
    expect(homeAlert({ ...none, notStarted: 3 }, false, null)?.title).toBe("Finish your training to start booking shifts");
  });
  it("warns about refreshers due soon", () => {
    expect(homeAlert({ ...none, dueSoon: 1 }, false, null)).toMatchObject({ tone: "warn", title: "1 refresher due soon" });
    expect(homeAlert({ ...none, dueSoon: 2 }, false, null)?.title).toBe("2 refreshers due soon");
  });
});

describe("homeEmpty", () => {
  it("sends new volunteers to training", () => {
    expect(homeEmpty({ ...none, notStarted: 3 }, true, null)).toMatchObject({ cta: "Book my initial visit", target: "training" });
    expect(homeEmpty({ ...none, notStarted: 3 }, true, visit)).toMatchObject({ cta: "Go to my training", target: "training" });
  });
  it("sends trained volunteers to shifts", () => {
    expect(homeEmpty(none, false, null)).toEqual({ text: "Browse the week and book a morning that suits.", cta: "Find a shift", target: "shifts" });
  });
});
