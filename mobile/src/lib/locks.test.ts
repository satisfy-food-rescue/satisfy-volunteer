import { describe, expect, it } from "vitest";

import { lockFix, lockLabel, unlockNote, type Lock, type LockFix } from "./locks";

const lock = (fix: LockFix): Lock => ({ kind: "BLOCKED", reason: `Needs ${fix}`, fix, moduleCode: null });

describe("locks", () => {
  it("labels each kind of lock", () => {
    expect(lockLabel("induction")).toBe("Induction needed");
    expect(lockLabel("training")).toBe("Training needed");
    expect(lockLabel("role")).toBe("Role needed");
    expect(lockLabel("harvestPool")).toBe("Join the pool");
  });

  it("says when locked shifts open up", () => {
    expect(unlockNote([lock("training")])).toBe("Locked shifts open up as soon as the training they need is current.");
    expect(unlockNote([lock("role")])).toBe("Locked shifts open up once you have the role they need.");
    expect(unlockNote([lock("harvestPool"), lock("training")])).toBe("Locked shifts open up once you have the role and the training they need.");
    expect(unlockNote([lock("induction")])).toBe("Locked shifts open up once your induction is done.");
    expect(unlockNote([lock("induction"), lock("training")])).toBe("Locked shifts open up once your induction is done and the training they need is current.");
    expect(unlockNote([lock("role"), lock("induction")])).toBe("Locked shifts open up once your induction is done and you have the role they need.");
  });

  it("offers the role first, then the induction, then training", () => {
    expect(lockFix([lock("training"), lock("role"), lock("induction")])).toBe("role");
    expect(lockFix([lock("training"), lock("induction")])).toBe("induction");
    expect(lockFix([lock("harvestPool"), lock("training")])).toBe("training");
    expect(lockFix([lock("harvestPool")])).toBe("harvestPool");
  });
});
