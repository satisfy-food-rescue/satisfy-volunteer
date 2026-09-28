import type { TrainingModule, TrainingRecord } from "@/generated/prisma/client";
import { dateToISO, daysBetween } from "./dates";
import {
  DUE_SOON_DAYS,
  ROLE_LABEL,
  SHIFT_KIND_LABEL,
  parseRoles,
  type ShiftKind,
  type TrainingStatus,
  type VolunteerRole,
} from "./domain";

export type ModuleStatus = {
  module: TrainingModule;
  status: TrainingStatus;
  required: boolean;
  record: TrainingRecord | null;
  completedISO: string | null;
  expiresISO: string | null;
  /** Days until expiry; negative when overdue; null when no expiry applies. */
  daysLeft: number | null;
};

export function moduleStatuses(
  volunteer: { roles: string },
  modules: TrainingModule[],
  records: TrainingRecord[],
  today: string,
): ModuleStatus[] {
  const roles = parseRoles(volunteer.roles);
  return [...modules]
    .sort((a, b) => a.order - b.order)
    .map((module) => {
      const required = parseRoles(module.requiredRoles).some((r) => roles.includes(r));
      const record =
        records
          .filter((r) => r.moduleId === module.id)
          .sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime())[0] ?? null;
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
      return { module, status, required, record, completedISO, expiresISO, daysLeft };
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
  blockers: Blocker[];
  /** First human-readable reason, or null when eligible. */
  reason: string | null;
};

/** The training gate. A volunteer can only book a shift kind when they hold
 *  the role and every module required for that role is current. */
export function eligibilityFor(
  volunteer: { roles: string },
  kind: ShiftKind,
  statuses: ModuleStatus[],
): Eligibility {
  const roles = parseRoles(volunteer.roles);
  const hasRole = roles.includes(kind as VolunteerRole);
  const kindLabel = SHIFT_KIND_LABEL[kind].toLowerCase();
  if (!hasRole) {
    return {
      eligible: false,
      hasRole: false,
      blockers: [],
      reason: `${SHIFT_KIND_LABEL[kind]} shifts need the ${ROLE_LABEL[kind as VolunteerRole].toLowerCase()} role. Ask the coordinator to add it to your profile.`,
    };
  }
  const blockers: Blocker[] = [];
  for (const m of statuses) {
    if (!parseRoles(m.module.requiredRoles).includes(kind as VolunteerRole)) continue;
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
  return { eligible: blockers.length === 0, hasRole, blockers, reason: blockers[0]?.message ?? null };
}
