// Domain vocabulary: the database enums (re-exported from the generated
// client, so a new enum value fails the build until it has a label) plus the
// labels and small helpers the UI and emails share. Safe to import from client
// components: the generated enums module has no runtime dependencies.
import {
  VolunteerRole as VolunteerRoleEnum,
  type AbsenceReason,
  type AccountRole,
  type AssignmentSource,
  type AssignmentStatus,
  type Channel,
  type ContactLogKind,
  type Delivery,
  type DeliveryStatus,
  type EmailKind,
  type ShiftStatus,
  type VolunteerStatus,
} from "@/generated/prisma/enums";

export type {
  AbsenceReason,
  AccountRole,
  AssignmentSource,
  AssignmentStatus,
  Channel,
  ContactLogKind,
  Delivery,
  DeliveryStatus,
  EmailKind,
  ShiftStatus,
  VolunteerStatus,
};

export type VolunteerRole = VolunteerRoleEnum;

/** Every volunteer role, in display order. */
export const VOLUNTEER_ROLES = [
  VolunteerRoleEnum.WAREHOUSE,
  VolunteerRoleEnum.DRIVERS_ASSISTANT,
  VolunteerRoleEnum.VOLUNTEER_DRIVER,
] as const satisfies readonly VolunteerRole[];

export const ROLE_LABEL: Record<VolunteerRole, string> = {
  WAREHOUSE: "Warehouse sorting",
  DRIVERS_ASSISTANT: "Driver help",
  VOLUNTEER_DRIVER: "Volunteer driver",
};

export const ROLE_SHORT: Record<VolunteerRole, string> = {
  WAREHOUSE: "Warehouse",
  DRIVERS_ASSISTANT: "Driver help",
  VOLUNTEER_DRIVER: "Driver",
};

/** A shift type's kind is the role needed to work it. */
export type ShiftKind = VolunteerRole;

export const SHIFT_KIND_LABEL: Record<ShiftKind, string> = ROLE_LABEL;

export const ABSENCE_REASON_LABEL: Record<AbsenceReason, string> = {
  HOLIDAY: "Holiday",
  SICK: "Sick",
  OTHER: "Other",
};

export const DELIVERY_LABEL: Record<Delivery, string> = {
  IN_PERSON: "In-person session",
  ONLINE_CONFIRM: "Online: read and confirm",
};

/** Derived per volunteer and module (see src/lib/training.ts), never stored. */
export type TrainingStatus =
  | "COMPLETE"
  | "DUE_SOON"
  | "OVERDUE"
  | "NOT_STARTED"
  | "NOT_REQUIRED";

export const TRAINING_STATUS_LABEL: Record<TrainingStatus, string> = {
  COMPLETE: "Complete",
  DUE_SOON: "Due soon",
  OVERDUE: "Overdue",
  NOT_STARTED: "Not started",
  NOT_REQUIRED: "Not required",
};

export const EMAIL_KIND_LABEL: Record<EmailKind, string> = {
  TRAINING_DUE_SOON: "Training due soon",
  TRAINING_OVERDUE: "Training overdue",
  TRAINING_OVERDUE_COORDINATOR: "Training overdue 3 weeks",
  SHIFT_REMINDER: "Shift reminder",
  ABSENCE_CONFIRMED: "Absence confirmed",
  COVER_CONFIRMED: "Cover confirmed",
  GAP_ALERT: "Coverage gap alert",
  APPLICATION_APPROVED: "Application approved",
  TRAINING_COMPLETED: "Training completed",
  SESSION_CONFIRMED: "Session RSVP confirmed",
  HARVEST_CALLOUT: "Harvest callout",
  LAST_MINUTE_CALLOUT: "Last-minute cover",
  GAP_ESCALATION: "Uncovered shift alert",
  ROLES_CHANGED: "Roles changed",
  ROLE_CHANGE_REQUEST: "Role change request",
  ACCOUNT_INVITE: "Sign-in invite",
  PASSWORD_RESET: "Password reset",
};

export const DELIVERY_STATUS_LABEL: Record<DeliveryStatus, string> = {
  PENDING: "Sending",
  SENT: "Sent",
  FAILED: "Not delivered",
  CAPTURED: "Demo: not sent",
};

export const CONTACT_LOG_LABEL: Record<ContactLogKind, string> = {
  CALL: "Phone call",
  NOTE: "Note",
  PROFILE_UPDATED: "Profile updated",
  ROLES_CHANGED: "Roles changed",
  VISIT_BOOKED: "Initial visit booked",
  ROLE_REQUEST: "Asked to change roles",
  ACCOUNT_CREATED: "Account created",
  STATUS_CHANGED: "Status changed",
};

/** The first in-person training stage. New volunteers cannot book shifts until
 *  it is done, and the coordinator often books it during the welcome call. */
export const INITIAL_VISIT_CODE = "INITIAL_VISIT";

/** Days before expiry at which a module flips from Complete to Due soon. */
export const DUE_SOON_DAYS = 30;

/** Keeps known roles only, de-duplicated, in display order. */
export function sortRoles(roles: readonly string[]): VolunteerRole[] {
  return VOLUNTEER_ROLES.filter((r) => roles.includes(r));
}

export function isVolunteerRole(value: string): value is VolunteerRole {
  return (VOLUNTEER_ROLES as readonly string[]).includes(value);
}

export function fullName(p: { firstName: string; lastName?: string | null }) {
  return p.lastName ? `${p.firstName} ${p.lastName}` : p.firstName;
}

export function initials(p: { firstName: string; lastName?: string | null }) {
  return `${p.firstName[0] ?? ""}${p.lastName?.[0] ?? ""}`.toUpperCase();
}

/** Emails are unique per person and compared case-insensitively. */
export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}
