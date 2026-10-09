// Enum-like values. Stored as String in SQLite (no enum support); in a
// Postgres production build these become Prisma enums with the same names.

export const VOLUNTEER_ROLES = [
  "WAREHOUSE",
  "DRIVERS_ASSISTANT",
  "VOLUNTEER_DRIVER",
] as const;
export type VolunteerRole = (typeof VOLUNTEER_ROLES)[number];

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

export type ShiftKind = VolunteerRole;

export const SHIFT_KIND_LABEL: Record<ShiftKind, string> = {
  WAREHOUSE: "Warehouse sorting",
  DRIVERS_ASSISTANT: "Driver help",
  VOLUNTEER_DRIVER: "Volunteer driver",
};

export type AssignmentStatus =
  | "CONFIRMED"
  | "RELEASED"
  | "CANCELLED"
  | "ATTENDED"
  | "NO_SHOW";
export type AssignmentSource = "REGULAR" | "BOOKED" | "COVER" | "ADMIN";

export type AbsenceReason = "HOLIDAY" | "SICK" | "OTHER";
export const ABSENCE_REASON_LABEL: Record<AbsenceReason, string> = {
  HOLIDAY: "Holiday",
  SICK: "Sick",
  OTHER: "Other",
};

export type Delivery = "IN_PERSON" | "ONLINE_CONFIRM";
export const DELIVERY_LABEL: Record<Delivery, string> = {
  IN_PERSON: "In-person session",
  ONLINE_CONFIRM: "Online: read and confirm",
};

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

export type ApplicationStatus = "PENDING" | "APPROVED" | "DECLINED";

export type EmailKind =
  | "TRAINING_DUE_SOON"
  | "TRAINING_OVERDUE"
  | "SHIFT_REMINDER"
  | "ABSENCE_CONFIRMED"
  | "COVER_CONFIRMED"
  | "GAP_ALERT"
  | "APPLICATION_APPROVED"
  | "TRAINING_COMPLETED"
  | "SESSION_CONFIRMED"
  | "HARVEST_CALLOUT"
  | "WELCOME"
  | "LAST_MINUTE_CALLOUT"
  | "GAP_ESCALATION"
  | "ROLES_CHANGED"
  | "ROLE_CHANGE_REQUEST"
  | "SHIFT_CANCELLED";

export const EMAIL_KIND_LABEL: Record<EmailKind, string> = {
  TRAINING_DUE_SOON: "Training due soon",
  TRAINING_OVERDUE: "Training overdue",
  SHIFT_REMINDER: "Shift reminder",
  ABSENCE_CONFIRMED: "Absence confirmed",
  COVER_CONFIRMED: "Cover confirmed",
  GAP_ALERT: "Coverage gap alert",
  APPLICATION_APPROVED: "Application approved",
  TRAINING_COMPLETED: "Training completed",
  SESSION_CONFIRMED: "Session RSVP confirmed",
  HARVEST_CALLOUT: "Harvest callout",
  WELCOME: "Welcome",
  LAST_MINUTE_CALLOUT: "Last-minute cover",
  GAP_ESCALATION: "Uncovered shift alert",
  ROLES_CHANGED: "Roles changed",
  ROLE_CHANGE_REQUEST: "Role change request",
  SHIFT_CANCELLED: "Shift cancelled",
};

export type Channel = "EMAIL" | "PUSH";

export type ContactLogKind = "CALL" | "NOTE" | "PROFILE_UPDATED" | "ROLES_CHANGED" | "VISIT_BOOKED" | "ROLE_REQUEST" | "SHIFT_CANCELLED";
export const CONTACT_LOG_LABEL: Record<ContactLogKind, string> = {
  CALL: "Phone call",
  NOTE: "Note",
  PROFILE_UPDATED: "Profile updated",
  ROLES_CHANGED: "Roles changed",
  VISIT_BOOKED: "Initial visit booked",
  ROLE_REQUEST: "Asked to change roles",
  SHIFT_CANCELLED: "Shift cancelled",
};

/** The first in-person training stage. New volunteers cannot book shifts until
 *  it is done, and the coordinator often books it during the welcome call. */
export const INITIAL_VISIT_CODE = "INITIAL_VISIT";

/** Days before expiry at which a module flips from Complete to Due soon. */
export const DUE_SOON_DAYS = 30;

export function parseRoles(csv: string): VolunteerRole[] {
  return csv
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is VolunteerRole =>
      (VOLUNTEER_ROLES as readonly string[]).includes(s),
    );
}

export function joinRoles(roles: readonly VolunteerRole[]): string {
  return VOLUNTEER_ROLES.filter((r) => roles.includes(r)).join(",");
}

export function fullName(p: { firstName: string; lastName?: string | null }) {
  return p.lastName ? `${p.firstName} ${p.lastName}` : p.firstName;
}

export function initials(p: { firstName: string; lastName?: string | null }) {
  return `${p.firstName[0] ?? ""}${p.lastName?.[0] ?? ""}`.toUpperCase();
}
