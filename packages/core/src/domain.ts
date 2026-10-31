// Domain vocabulary shared by the web app and the native app. Each union
// matches a Postgres enum in prisma/schema.prisma; src/lib/domain.ts fails the
// web build if the two drift apart, so a new value needs a label here first.

export const VOLUNTEER_ROLES = [
  "WAREHOUSE",
  "DRIVERS_ASSISTANT",
  "VOLUNTEER_DRIVER",
  "HARVEST",
] as const;
export type VolunteerRole = (typeof VOLUNTEER_ROLES)[number];

export const ROLE_LABEL: Record<VolunteerRole, string> = {
  WAREHOUSE: "Warehouse sorting",
  DRIVERS_ASSISTANT: "Driver help",
  VOLUNTEER_DRIVER: "Volunteer driver",
  HARVEST: "Harvest",
};

export const ROLE_SHORT: Record<VolunteerRole, string> = {
  WAREHOUSE: "Warehouse",
  DRIVERS_ASSISTANT: "Driver help",
  VOLUNTEER_DRIVER: "Driver",
  HARVEST: "Harvest",
};

/** What each role involves, for someone signing up. */
export const ROLE_DESCRIPTION: Record<VolunteerRole, string> = {
  WAREHOUSE: "Sort and pack rescued kai at the warehouse in Rangiora.",
  DRIVERS_ASSISTANT: "Ride along on a pickup route and help the driver load and deliver.",
  VOLUNTEER_DRIVER: "Drive a pickup route. Needs a current full driver licence.",
  HARVEST: "Pick fruit from local trees and orchards when it is in season.",
};

/** The harvest pool is the HARVEST role. Unlike the other roles, volunteers
 *  join and leave it themselves. */
export const HARVEST_ROLE: VolunteerRole = "HARVEST";

export type ShiftKind = VolunteerRole;

export const SHIFT_KIND_LABEL: Record<ShiftKind, string> = {
  WAREHOUSE: "Warehouse sorting",
  DRIVERS_ASSISTANT: "Driver help",
  VOLUNTEER_DRIVER: "Volunteer driver",
  HARVEST: "Harvest",
};

/** Ad hoc kinds are created one shift at a time, not from a weekly pattern.
 *  They have no regulars, so an unfilled place is not a gap to cover: it is
 *  just open, and stays out of the cover lists and last-minute pushes. */
export function isAdHocKind(kind: ShiftKind): boolean {
  return kind === "HARVEST";
}

export type AccountRole = "ADMIN" | "VOLUNTEER";
export type VolunteerStatus = "ACTIVE" | "INACTIVE" | "DELETED";

export type ShiftStatus = "DRAFT" | "SCHEDULED" | "CANCELLED";

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
  ONLINE_CONFIRM: "Online module",
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

export type TrainingMethod = "SESSION" | "ONLINE" | "COORDINATOR";
export type RsvpStatus = "GOING" | "DECLINED";

export type ApplicationStatus = "PENDING" | "APPROVED" | "DECLINED";

/** Where someone signed up: the website or the app. A plain string column,
 *  not a Postgres enum. */
export type ApplicationSource = "WEBSITE" | "APP";
export const APPLICATION_SOURCE_LABEL: Record<ApplicationSource, string> = {
  WEBSITE: "Website sign-up",
  APP: "App sign-up",
};

export function applicationSourceLabel(source: string): string {
  return APPLICATION_SOURCE_LABEL[source as ApplicationSource] ?? source;
}

export type EmailKind =
  | "TRAINING_DUE_SOON"
  | "TRAINING_OVERDUE"
  | "TRAINING_OVERDUE_COORDINATOR"
  | "SHIFT_REMINDER"
  | "ABSENCE_CONFIRMED"
  | "COVER_CONFIRMED"
  | "GAP_ALERT"
  | "APPLICATION_APPROVED"
  | "TRAINING_COMPLETED"
  | "SESSION_CONFIRMED"
  | "HARVEST_CALLOUT"
  | "LAST_MINUTE_CALLOUT"
  | "GAP_ESCALATION"
  | "ROLES_CHANGED"
  | "ROLE_CHANGE_REQUEST"
  | "SHIFT_CANCELLED"
  | "SHIFT_ADDED"
  | "SHIFT_PUBLISHED"
  | "ANNOUNCEMENT"
  | "ACCOUNT_INVITE"
  | "PASSWORD_RESET"
  | "ADMIN_ACCESS"
  | "APPLICATION_RECEIVED"
  | "APPLICATION_NEW"
  | "ALREADY_REGISTERED"
  | "ACCOUNT_DELETED";

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
  SHIFT_CANCELLED: "Shift cancelled",
  SHIFT_ADDED: "Added to a shift",
  SHIFT_PUBLISHED: "New shift",
  ANNOUNCEMENT: "Announcement",
  ACCOUNT_INVITE: "Sign-in invite",
  PASSWORD_RESET: "Password reset",
  ADMIN_ACCESS: "Coordinator access",
  APPLICATION_RECEIVED: "Application received",
  APPLICATION_NEW: "New application",
  ALREADY_REGISTERED: "Already has an account",
  ACCOUNT_DELETED: "Account deleted",
};

export type Channel = "EMAIL" | "PUSH";

/** PENDING: recorded, not yet handed to the provider. CAPTURED: demo mode,
 *  recorded for the Outbox and never sent. */
export type DeliveryStatus = "PENDING" | "SENT" | "FAILED" | "CAPTURED";
export const DELIVERY_STATUS_LABEL: Record<DeliveryStatus, string> = {
  PENDING: "Sending",
  SENT: "Sent",
  FAILED: "Not delivered",
  CAPTURED: "Demo: not sent",
};

/** Who an announcement goes to. */
export type AnnouncementAudience = "ALL" | "ROLES" | "SHIFT";

export type ContactLogKind =
  | "CALL"
  | "NOTE"
  | "PROFILE_UPDATED"
  | "ROLES_CHANGED"
  | "VISIT_BOOKED"
  | "ROLE_REQUEST"
  | "SHIFT_CANCELLED"
  | "ACCOUNT_CREATED"
  | "STATUS_CHANGED"
  | "ADMIN_ACCESS";
export const CONTACT_LOG_LABEL: Record<ContactLogKind, string> = {
  CALL: "Phone call",
  NOTE: "Note",
  PROFILE_UPDATED: "Profile updated",
  ROLES_CHANGED: "Roles changed",
  VISIT_BOOKED: "Initial visit booked",
  ROLE_REQUEST: "Asked to change roles",
  SHIFT_CANCELLED: "Shift cancelled",
  ACCOUNT_CREATED: "Account created",
  STATUS_CHANGED: "Status changed",
  ADMIN_ACCESS: "Coordinator access",
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

export function inHarvestPool(v: { roles: readonly VolunteerRole[] }): boolean {
  return v.roles.includes(HARVEST_ROLE);
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
