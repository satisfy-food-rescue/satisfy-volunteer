import type { ShiftAction, ShiftSummary } from "@satisfy/core/api";

export type Lock = Extract<ShiftAction, { kind: "BLOCKED" }>;
export type LockFix = Lock["fix"];

/** The locks on these shifts, one per reason, in the order they first
 *  appear. */
export function locksOf(shifts: ShiftSummary[]): Lock[] {
  const byReason = new Map<string, Lock>();
  for (const s of shifts) if (s.action.kind === "BLOCKED" && !byReason.has(s.action.reason)) byReason.set(s.action.reason, s.action);
  return [...byReason.values()];
}

/** The short label on a locked shift's chip. */
export function lockLabel(fix: LockFix): string {
  switch (fix) {
    case "harvestPool":
      return "Join the pool";
    case "role":
      return "Role needed";
    case "induction":
      return "Induction needed";
    case "training":
      return "Training needed";
  }
}

/** When locked shifts open up, in the web's words for each case. Joining
 *  the harvest pool counts as having the role, as it gives the volunteer
 *  the harvest role. */
export function unlockNote(locks: Lock[]): string {
  const role = locks.some((l) => l.fix === "role" || l.fix === "harvestPool");
  const training = locks.some((l) => l.fix === "training");
  const induction = locks.some((l) => l.fix === "induction");
  if (induction) {
    return role && training
      ? "Locked shifts open up once your induction is done and you have the role and the training they need."
      : role
        ? "Locked shifts open up once your induction is done and you have the role they need."
        : training
          ? "Locked shifts open up once your induction is done and the training they need is current."
          : "Locked shifts open up once your induction is done.";
  }
  return role && training
    ? "Locked shifts open up once you have the role and the training they need."
    : role
      ? "Locked shifts open up once you have the role they need."
      : "Locked shifts open up as soon as the training they need is current.";
}

/** The one step the lock banner offers. A missing role is the coordinator's
 *  to fix, so it comes first, as on the web; then the induction, since
 *  training only opens once it is done; then training; then the pool. */
export function lockFix(locks: Lock[]): LockFix {
  const order: LockFix[] = ["role", "induction", "training", "harvestPool"];
  return order.find((fix) => locks.some((l) => l.fix === fix)) ?? "training";
}
