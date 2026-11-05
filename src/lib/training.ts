import type { TrainingModule, TrainingRecord } from "@/generated/prisma/client";
import { dateToISO, daysBetween } from "./dates";
import { inductionBlockers, type Induction } from "./induction";
import {
  DUE_SOON_DAYS,
  HARVEST_ROLE,
  ROLE_LABEL,
  SHIFT_KIND_LABEL,
  type ShiftKind,
  type TrainingStatus,
  type VolunteerRole,
} from "./domain";

export type ModuleStatus = {
  module: TrainingModule;
  status: TrainingStatus;
  /** Needed for one of the volunteer's roles. Never for a module still in
   *  development, which volunteers see as coming soon. */
  required: boolean;
  /** Not done yet, and its prerequisite is not either: stages run in order,
   *  so this one waits. */
  lockedBy: TrainingModule | null;
  record: TrainingRecord | null;
  completedISO: string | null;
  expiresISO: string | null;
  /** Days until expiry; negative when overdue; null when no expiry applies. */
  daysLeft: number | null;
};

export function moduleStatuses(
  volunteer: { roles: readonly VolunteerRole[] },
  modules: TrainingModule[],
  records: TrainingRecord[],
  today: string,
): ModuleStatus[] {
  const roles = volunteer.roles;
  const done = new Set(records.map((r) => r.moduleId));
  const byId = new Map(modules.map((m) => [m.id, m]));
  return [...modules]
    .sort((a, b) => a.order - b.order)
    .map((module) => {
      const required = !module.inDevelopment && module.requiredRoles.some((r) => roles.includes(r));
      const record =
        records
          .filter((r) => r.moduleId === module.id)
          .sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime())[0] ?? null;
      const prerequisite = module.prerequisiteId ? byId.get(module.prerequisiteId) : undefined;
      const lockedBy = !record && prerequisite && !done.has(prerequisite.id) ? prerequisite : null;
      const completedISO = record ? dateToISO(record.completedAt) : null;
      const expiresISO = record?.expiresAt ? dateToISO(record.expiresAt) : null;
      const daysLeft = expiresISO ? daysBetween(today, expiresISO) : null;
      let status: TrainingStatus;
      if (!required) status = "NOT_REQUIRED";
      else if (!record) status = "NOT_STARTED";
      else if (daysLeft === null) status = "COMPLETE";
      else if (daysLeft < 0) status = "OVERDUE";
      else if (daysLeft <= DUE_SOON_DAYS) status = "DUE_SOON";
      else status = "COMPLETE";
      return { module, status, required, lockedBy, record, completedISO, expiresISO, daysLeft };
    });
}

export function trainingSummary(statuses: ModuleStatus[]) {
  const count = (s: TrainingStatus) => statuses.filter((m) => m.status === s).length;
  const overdue = count("OVERDUE");
  const dueSoon = count("DUE_SOON");
  const notStarted = count("NOT_STARTED");
  const complete = count("COMPLETE");
  const required = statuses.filter((m) => m.required).length;
  return {
    overdue,
    dueSoon,
    notStarted,
    complete,
    required,
    // Compliant = every required module is current (Complete or Due soon).
    compliant: overdue === 0 && notStarted === 0,
    /** Worst status, for a single roll-up chip. */
    worst: (overdue ? "OVERDUE" : notStarted ? "NOT_STARTED" : dueSoon ? "DUE_SOON" : "COMPLETE") as TrainingStatus,
  };
}

export type Blocker = { module: TrainingModule; status: TrainingStatus; message: string };

export type Eligibility = {
  eligible: boolean;
  hasRole: boolean;
  /** Induction steps in the way (the Ministry of Justice check, agreements to
   *  sign). They come before training. */
  induction: string[];
  blockers: Blocker[];
  /** First human-readable reason, or null when eligible. */
  reason: string | null;
};

/** What unblocks a locked shift: finishing the induction, current training,
 *  a role (only a coordinator adds one), or for a harvest, joining the pool. */
export type LockFix = "induction" | "training" | "role" | "harvestPool";

export function lockFix(elig: Eligibility, kind: ShiftKind): LockFix {
  if (!elig.hasRole) return kind === HARVEST_ROLE ? "harvestPool" : "role";
  return elig.induction.length > 0 ? "induction" : "training";
}

/** The chip on a locked shift. */
export const LOCK_LABEL: Record<LockFix, string> = { induction: "Induction needed", training: "Training needed", role: "Role needed", harvestPool: "Join the pool" };

/** The booking gate. A volunteer can only book a shift kind when they hold
 *  the role, their induction is done for it, and every module required for
 *  that role is current. */
export function eligibilityFor(
  volunteer: { roles: readonly VolunteerRole[] },
  kind: ShiftKind,
  statuses: ModuleStatus[],
  induction: Induction | null,
): Eligibility {
  const hasRole = volunteer.roles.includes(kind);
  const kindLabel = SHIFT_KIND_LABEL[kind].toLowerCase();
  if (!hasRole) {
    return {
      eligible: false,
      hasRole: false,
      induction: [],
      blockers: [],
      reason:
        kind === HARVEST_ROLE
          ? "Join the harvest pool to sign up for harvests."
          : `${SHIFT_KIND_LABEL[kind]} shifts need the ${ROLE_LABEL[kind].toLowerCase()} role. Ask the coordinator to add it to your profile.`,
    };
  }
  const blockers: Blocker[] = [];
  for (const m of statuses) {
    if (!m.module.requiredRoles.includes(kind)) continue;
    if (m.status === "OVERDUE") {
      blockers.push({ module: m.module, status: m.status, message: `Complete the ${m.module.name} refresher to book ${kindLabel} shifts` });
    } else if (m.status === "NOT_STARTED") {
      blockers.push({
        module: m.module,
        status: m.status,
        message: m.module.mandatoryBeforeFirstShift
          ? `Complete ${m.module.name} before your first shift`
          : `Complete ${m.module.name} to book ${kindLabel} shifts`,
      });
    }
  }
  const steps = induction ? inductionBlockers(induction, [kind]) : [];
  return { eligible: steps.length === 0 && blockers.length === 0, hasRole, induction: steps, blockers, reason: steps[0] ?? blockers[0]?.message ?? null };
}
