// Induction: what a volunteer must have in place before they can train or
// book shifts. Two parts, each switched on by the coordinator:
//  - a current Ministry of Justice check, for the roles set in Admin >
//    Induction (Settings.mojCheckRoles). The volunteer requests it
//    themselves; a coordinator sights it and records the date. It is renewed
//    every three years.
//  - the agreements (Documents of kind AGREEMENT) for their roles, signed in
//    the app with a tick box. Publishing a new version asks for it again.
// Pure: the loaders in volunteer-data.ts and the admin pages feed it rows.
import type { Document, Volunteer } from "@/generated/prisma/client";
import type { ModuleStatus } from "./training";
import { addMonths, dateToISO, daysBetween } from "./dates";
import { MOJ_CHECK_YEARS, MOJ_RENEWAL_DAYS, type VolunteerRole } from "./domain";

export type MojStatus = "NOT_REQUIRED" | "NEEDED" | "CURRENT" | "RENEWAL_DUE" | "EXPIRED";

export const MOJ_STATUS_LABEL: Record<MojStatus, string> = {
  NOT_REQUIRED: "Not required",
  NEEDED: "Not recorded",
  CURRENT: "Current",
  RENEWAL_DUE: "Renewal due",
  EXPIRED: "Expired",
};

export type Moj = {
  status: MojStatus;
  required: boolean;
  /** The roles that need it, of those the volunteer holds. */
  roles: VolunteerRole[];
  checkedISO: string | null;
  renewsISO: string | null;
  /** Days until renewal; negative once expired. */
  daysLeft: number | null;
};

export type AgreementStatus = "SIGNED" | "UNSIGNED" | "UPDATED" | "NOT_REQUIRED";

export type AgreementState = {
  document: Document;
  status: AgreementStatus;
  required: boolean;
  /** The latest version they signed, and when. */
  signedVersion: number | null;
  signedAt: Date | null;
};

export type Induction = {
  moj: Moj;
  agreements: AgreementState[];
  /** Everything required is in place (a check due for renewal still counts). */
  complete: boolean;
  /** Steps left to do: the check, plus each agreement to sign. */
  outstanding: number;
};

export type InductionInput = {
  mojCheckRoles: readonly VolunteerRole[];
  /** The volunteer's checks, any order. */
  checks: readonly { checkedOn: Date }[];
  /** Agreements in force (not archived), in display order. */
  agreements: readonly Document[];
  /** The volunteer's acknowledgements, any document or version. */
  acknowledgements: readonly { documentId: string; version: number; createdAt: Date }[];
};

/** When a check dated `checkedISO` needs renewing. */
export function mojRenewsISO(checkedISO: string): string {
  return addMonths(checkedISO, MOJ_CHECK_YEARS * 12);
}

export function mojStatus(roles: readonly VolunteerRole[], mojCheckRoles: readonly VolunteerRole[], checks: readonly { checkedOn: Date }[], today: string): Moj {
  const needs = roles.filter((r) => mojCheckRoles.includes(r));
  const latest = [...checks].sort((a, b) => b.checkedOn.getTime() - a.checkedOn.getTime())[0];
  const checkedISO = latest ? dateToISO(latest.checkedOn) : null;
  const renewsISO = checkedISO ? mojRenewsISO(checkedISO) : null;
  const daysLeft = renewsISO ? daysBetween(today, renewsISO) : null;
  const required = needs.length > 0;
  let status: MojStatus;
  if (daysLeft === null) status = required ? "NEEDED" : "NOT_REQUIRED";
  else if (daysLeft < 0) status = required ? "EXPIRED" : "NOT_REQUIRED";
  else if (daysLeft <= MOJ_RENEWAL_DAYS) status = required ? "RENEWAL_DUE" : "CURRENT";
  else status = "CURRENT";
  return { status, required, roles: needs, checkedISO, renewsISO, daysLeft };
}

export function inductionStatus(volunteer: { roles: readonly VolunteerRole[] }, input: InductionInput, today: string): Induction {
  const moj = mojStatus(volunteer.roles, input.mojCheckRoles, input.checks, today);
  const agreements = input.agreements.map((document): AgreementState => {
    const required = document.roles.some((r) => volunteer.roles.includes(r));
    const signed = input.acknowledgements.filter((a) => a.documentId === document.id).sort((a, b) => b.version - a.version)[0];
    const status: AgreementStatus = !required ? "NOT_REQUIRED" : !signed ? "UNSIGNED" : signed.version < document.version ? "UPDATED" : "SIGNED";
    return { document, status, required, signedVersion: signed?.version ?? null, signedAt: signed?.createdAt ?? null };
  });
  const mojOutstanding = moj.status === "NEEDED" || moj.status === "EXPIRED";
  const toSign = agreements.filter((a) => a.status === "UNSIGNED" || a.status === "UPDATED").length;
  return { moj, agreements, complete: !mojOutstanding && toSign === 0, outstanding: (mojOutstanding ? 1 : 0) + toSign };
}

/** What stops this volunteer doing something that needs these roles (a shift
 *  kind, or a training module's roles), in the words shown on the button.
 *  Empty when nothing does. */
export function inductionBlockers(induction: Induction, roles: readonly VolunteerRole[]): string[] {
  const out: string[] = [];
  const { moj } = induction;
  if (roles.some((r) => moj.roles.includes(r))) {
    if (moj.status === "NEEDED") out.push("We need to see your Ministry of Justice check first");
    if (moj.status === "EXPIRED") out.push("Your Ministry of Justice check needs renewing");
  }
  for (const a of induction.agreements) {
    if (!roles.some((r) => a.document.roles.includes(r))) continue;
    if (a.status === "UNSIGNED") out.push(`Sign the ${a.document.title} first`);
    if (a.status === "UPDATED") out.push(`Sign the updated ${a.document.title} first`);
  }
  return out;
}

/** What is left, as what we need: "your Ministry of Justice check and your
 *  signature on the Volunteer Agreement". Empty when nothing is. */
export function inductionToDo(induction: Induction): string {
  const parts: string[] = [];
  if (induction.moj.status === "NEEDED") parts.push("your Ministry of Justice check");
  if (induction.moj.status === "EXPIRED") parts.push("a new Ministry of Justice check");
  const toSign = induction.agreements.filter((a) => a.status === "UNSIGNED" || a.status === "UPDATED").map((a) => a.document.title);
  if (toSign.length > 0) parts.push(`your signature on the ${toSign.length === 1 ? toSign[0] : `${toSign.slice(0, -1).join(", ")} and ${toSign.at(-1)}`}`);
  return parts.join(" and ");
}

/** The roles a training module is done for: those it is required for that
 *  the volunteer holds, else all the volunteer's roles. */
export function moduleRoles(module: { requiredRoles: readonly VolunteerRole[] }, roles: readonly VolunteerRole[]): VolunteerRole[] {
  const mine = module.requiredRoles.filter((r) => roles.includes(r));
  return mine.length > 0 ? mine : [...roles];
}

/** Nothing is required: no check for any role, and no agreements. */
export const NO_INDUCTION: Induction = {
  moj: { status: "NOT_REQUIRED", required: false, roles: [], checkedISO: null, renewsISO: null, daysLeft: null },
  agreements: [],
  complete: true,
  outstanding: 0,
};

/** Why a module is closed: still in development, the induction comes
 *  first, or an earlier stage (`ModuleStatus.lockedBy`) does. */
export type TrainingLockKind = "development" | "induction" | "after";
export type TrainingLock = { kind: TrainingLockKind; text: string };

/** Why the volunteer cannot do this module yet, in their words, or null
 *  when they can. The induction comes before any stage order. */
export function trainingLockOf(me: Pick<Volunteer, "roles">, status: ModuleStatus, induction: Induction): TrainingLock | null {
  if (status.module.inDevelopment) return { kind: "development", text: `${status.module.name} is still being put together. It will open here when it is ready.` };
  const steps = inductionBlockers(induction, moduleRoles(status.module, me.roles));
  if (steps.length > 0) return { kind: "induction", text: `Finish your induction before training: ${steps[0]!.charAt(0).toLowerCase()}${steps[0]!.slice(1)}.` };
  if (status.lockedBy) return { kind: "after", text: `Complete ${status.lockedBy.name} first.` };
  return null;
}

export function trainingLock(me: Pick<Volunteer, "roles">, status: ModuleStatus, induction: Induction): string | null {
  return trainingLockOf(me, status, induction)?.text ?? null;
}
