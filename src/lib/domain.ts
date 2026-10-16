// Shared with the native app. Edit packages/core/src/domain.ts.
export * from "@satisfy/core/domain";

import type * as Core from "@satisfy/core/domain";
import type * as Db from "@/generated/prisma/enums";

// The vocabulary is written once, in packages/core (the native app cannot
// import the Prisma client), and the database enums are its source of truth.
// Each line fails the build if a value is added to one side and not the other.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;

export type EnumsMatch = [
  Assert<Same<Core.AccountRole, Db.AccountRole>>,
  Assert<Same<Core.VolunteerStatus, Db.VolunteerStatus>>,
  Assert<Same<Core.VolunteerRole, Db.VolunteerRole>>,
  Assert<Same<Core.ShiftStatus, Db.ShiftStatus>>,
  Assert<Same<Core.AssignmentSource, Db.AssignmentSource>>,
  Assert<Same<Core.AssignmentStatus, Db.AssignmentStatus>>,
  Assert<Same<Core.AbsenceReason, Db.AbsenceReason>>,
  Assert<Same<Core.Delivery, Db.Delivery>>,
  Assert<Same<Core.TrainingMethod, Db.TrainingMethod>>,
  Assert<Same<Core.RsvpStatus, Db.RsvpStatus>>,
  Assert<Same<Core.ApplicationStatus, Db.ApplicationStatus>>,
  Assert<Same<Core.Channel, Db.Channel>>,
  Assert<Same<Core.EmailKind, Db.EmailKind>>,
  Assert<Same<Core.DeliveryStatus, Db.DeliveryStatus>>,
  Assert<Same<Core.AnnouncementAudience, Db.AnnouncementAudience>>,
  Assert<Same<Core.ContactLogKind, Db.ContactLogKind>>,
];
