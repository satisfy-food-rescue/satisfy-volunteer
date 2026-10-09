// The contract between the native app and /api/mobile/*. Types only, so the
// app and the server agree at compile time without sharing runtime code.
//
// Conventions:
// - Every request except sign-in carries `Authorization: Bearer <token>`.
//   A missing, unknown or expired token is a 401 and the app signs out.
// - Calendar dates are "YYYY-MM-DD" (NZ) and wall-clock times "HH:MM" (NZ);
//   the app formats them with @satisfy/core/dates. Instants (session times)
//   come pre-formatted in NZ time as well as ISO, so the app never needs a
//   time-zone database.
// - Reads return the payload type directly. Mutations return MutationOk on
//   success; any failure is a non-2xx status with ApiFailure, whose `error`
//   is written for the volunteer and shown as is.

import type {
  AbsenceReason,
  AssignmentSource,
  Delivery,
  ShiftKind,
  TrainingStatus,
  VolunteerRole,
} from "./domain";

export type MutationOk = { message: string };
export type ApiFailure = { error: string };

// Auth ----------------------------------------------------------------------

/** GET /api/mobile/auth/personas (demo only). The volunteer personas a
 *  demo user can sign in as. The coordinator persona is web-only. */
export type DemoPersona = {
  key: string;
  firstName: string;
  lastName: string | null;
  label: string;
  blurb: string;
};
export type DemoPersonas = { personas: DemoPersona[] };

/** POST /api/mobile/auth/demo with DemoSignInInput. */
export type DemoSignInInput = { personaKey: string };
export type SignInResult = { token: string; session: MobileSession };

/** DELETE /api/mobile/auth/session with SignOutInput signs this device out
 *  and forgets its push token. Returns MutationOk. */
export type SignOutInput = { pushToken?: string };

// Session -------------------------------------------------------------------

export type Me = {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string;
  phone: string | null;
  suburb: string | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
  availabilityNote: string | null;
  lastMinuteOk: boolean;
  inHarvestPool: boolean;
  roles: VolunteerRole[];
  joinedISO: string;
  infoodle: { id: string; syncedLabel: string | null } | null;
};

/** GET /api/mobile/session. Who is signed in, plus the tab badges. */
export type MobileSession = {
  me: Me;
  today: string;
  /** True on the demo deployment: the app shows "Switch persona". */
  demo: boolean;
  badges: {
    /** Open gaps in the next four weeks the volunteer did not cause. */
    cover: number;
    /** Required modules overdue or not started. */
    training: number;
  };
};

// Shifts --------------------------------------------------------------------

export type CrewMember = {
  assignmentId: string;
  volunteerId: string;
  firstName: string;
  lastName: string | null;
  source: AssignmentSource;
  isMe: boolean;
};

/** What the volunteer can do with a shift, worked out on the server so the
 *  app never re-implements the booking rules. */
export type ShiftAction =
  | { kind: "PAST" }
  /** The coordinator cancelled it; nobody should turn up. */
  | { kind: "CANCELLED" }
  | { kind: "MINE"; assignmentId: string; source: AssignmentSource }
  /** `fix` says what unblocks it: current training, or a role the
   *  volunteer does not hold yet (only a coordinator can add one). */
  | { kind: "BLOCKED"; reason: string; fix: "training" | "role"; moduleCode: string | null }
  | { kind: "FULL" }
  | { kind: "BOOK"; cover: boolean };

export type ShiftSummary = {
  id: string;
  iso: string;
  kind: ShiftKind;
  name: string;
  startTime: string;
  endTime: string;
  location: string;
  capacity: number;
  needed: number;
  confirmedCount: number;
  spotsLeft: number;
  isFull: boolean;
  /** Confirmed crew below the minimum needed. */
  isGap: boolean;
  shortBy: number;
  /** Why the gap exists, e.g. "Brian Tweedie away (holiday)". */
  causes: string[];
  crew: CrewMember[];
  action: ShiftAction;
};

export type ShiftDetail = ShiftSummary & {
  workingWith: string | null;
  volunteerDriven: boolean;
  /** Donor stops for route shifts. */
  stops: string[];
};

/** GET /api/mobile/shifts?week=YYYY-MM-DD (any day in the week; defaults to
 *  this week). Monday to Friday. */
export type ShiftsWeek = {
  today: string;
  monday: string;
  days: { iso: string; away: boolean; shifts: ShiftSummary[] }[];
};

/** GET /api/mobile/shifts/:id returns ShiftDetail.
 *  POST /api/mobile/shifts/:id/book returns MutationOk.
 *  POST /api/mobile/assignments/:id/cancel returns MutationOk. */

/** GET /api/mobile/cover. Gaps in the next four weeks, soonest first,
 *  excluding shifts the volunteer was released from. */
export type CoverList = {
  today: string;
  shifts: ShiftSummary[];
};

// Home ----------------------------------------------------------------------

export type Tone = "good" | "warn" | "bad" | "info" | "neutral";

export type HomeAlert = { tone: "bad" | "warn" | "info"; title: string; text: string };

/** GET /api/mobile/home */
export type Home = {
  today: string;
  next: ShiftSummary | null;
  /** Shown instead of the next shift when nothing is booked. */
  empty: { text: string; cta: string; target: "training" | "shifts" };
  alert: HomeAlert | null;
  cover: { count: number; next: { iso: string; name: string } | null };
  harvest: { id: string; title: string; iso: string; going: boolean } | null;
  impact: {
    kgRescued: number;
    meals: number;
    co2Tonnes: number;
    co2Period: string;
    yearsRunning: number;
  };
};

// Training ------------------------------------------------------------------

export type ModuleSummary = {
  id: string;
  code: string;
  name: string;
  description: string;
  delivery: Delivery;
  validityMonths: number | null;
  mandatoryBeforeFirstShift: boolean;
  status: TrainingStatus;
  required: boolean;
  completedISO: string | null;
  expiresISO: string | null;
  /** Days until expiry; negative when overdue; null when no expiry applies. */
  daysLeft: number | null;
};

export type TrainingSessionItem = {
  id: string;
  moduleId: string;
  moduleName: string;
  /** Pre-formatted NZ time, e.g. "Tue 6 Oct, 10:30am to 12pm". */
  whenLabel: string;
  startsAt: string;
  location: string;
  capacity: number;
  going: number;
  mine: "GOING" | "DECLINED" | null;
  /** The volunteer needs this module and it is not complete. */
  relevant: boolean;
  full: boolean;
};

/** GET /api/mobile/training */
export type TrainingOverview = {
  today: string;
  summary: {
    overdue: number;
    dueSoon: number;
    notStarted: number;
    required: number;
    /** Required modules Complete or Due soon. */
    current: number;
    compliant: boolean;
  };
  required: ModuleSummary[];
  notRequired: ModuleSummary[];
  /** Relevant sessions first, then the rest, each soonest first. */
  sessions: TrainingSessionItem[];
};

/** GET /api/mobile/training/modules/:code */
export type TrainingModuleDetail = {
  today: string;
  module: ModuleSummary;
  paragraphs: string[];
};

/** POST /api/mobile/training/modules/:id/complete returns MutationOk.
 *  POST /api/mobile/training/sessions/:id/rsvp with RsvpInput returns MutationOk. */
export type RsvpInput = { going: boolean };

// Regular slot and absences -------------------------------------------------

/** GET /api/mobile/slot */
export type SlotOverview = {
  today: string;
  slots: { id: string; weekday: number; name: string; startTime: string; endTime: string }[];
  absences: {
    id: string;
    startISO: string;
    endISO: string;
    reason: AbsenceReason;
    note: string | null;
    releasedCount: number;
    removable: boolean;
  }[];
  /** Confirmed shifts in the next 90 days, to preview what an absence releases. */
  upcoming: { iso: string; name: string }[];
};

/** POST /api/mobile/absences returns MutationOk.
 *  DELETE /api/mobile/absences/:id returns MutationOk. */
export type AwayInput = {
  startDate: string;
  endDate: string;
  reason: AbsenceReason;
  note?: string;
};

// Harvest -------------------------------------------------------------------

/** GET /api/mobile/harvest */
export type HarvestOverview = {
  today: string;
  inPool: boolean;
  poolCount: number;
  callouts: {
    id: string;
    title: string;
    iso: string;
    startTime: string;
    endTime: string;
    location: string;
    partner: string;
    description: string;
    needed: number;
    going: { volunteerId: string; firstName: string; lastName: string | null }[];
    mine: "GOING" | "DECLINED" | null;
  }[];
};

/** PUT /api/mobile/harvest/pool with HarvestPoolInput returns MutationOk.
 *  POST /api/mobile/harvest/callouts/:id/rsvp with RsvpInput returns MutationOk. */
export type HarvestPoolInput = { inPool: boolean };

// Profile -------------------------------------------------------------------

/** PATCH /api/mobile/profile returns MutationOk. Empty strings clear a field. */
export type ProfileInput = {
  phone: string;
  suburb: string;
  emergencyName: string;
  emergencyPhone: string;
  availabilityNote: string;
  lastMinuteOk: boolean;
};

/** POST /api/mobile/profile/role-request returns MutationOk. */
export type RoleRequestInput = { message: string };

// Push notifications --------------------------------------------------------

/** POST /api/mobile/push-tokens registers this device; DELETE with the same
 *  body forgets it. Both return MutationOk. */
export type PushTokenInput = {
  token: string;
  platform: "ios" | "android";
  deviceName?: string;
};

/** The `data` on every push the server sends. `url` is a web app path such as
 *  "/app/shifts/abc"; the app maps it to its own screen. */
export type PushData = { url?: string; kind: string };
