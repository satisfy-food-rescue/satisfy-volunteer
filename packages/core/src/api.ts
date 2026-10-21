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

import type { ModuleLink } from "./training";
import type {
  AbsenceReason,
  AssignmentSource,
  Delivery,
  ShiftKind,
  TrainingStatus,
  VolunteerRole,
} from "./domain";

export type MutationOk = { message: string };
/** A 400 from a form can add `fields`, a message per request field, so the
 *  form can show each beside its field; `error` is then the first of them. */
export type ApiFailure = { error: string; fields?: Record<string, string> };

// Auth ----------------------------------------------------------------------
//
// Volunteers sign in to the app the same ways as the website: password,
// Google (in the system browser, handed back with a PKCE-bound code), Apple
// (natively on iOS; in the system browser like Google on Android) or a
// passkey (shared with the website: same relying party). Every sign-in
// returns SignInResult. Accounts are never created from the app: signing up
// sends an application, and the coordinator's approval creates the account.

/** GET /api/mobile/auth/config. Which sign-in methods this server offers,
 *  so the app only shows buttons that work. */
export type AuthConfig = {
  /** The demo deployment: show the persona picker instead. */
  demo: boolean;
  google: boolean;
  /** Sign in with Apple: natively on iOS, in the system browser on Android. */
  apple: boolean;
  /** Passkeys are set up for this platform (the app sends X-Platform). */
  passkeys: boolean;
  /** The website, for "Forgot your password?" and Sign-in and security. */
  webUrl: string;
};

/** POST /api/mobile/auth/password */
export type PasswordSignInInput = { email: string; password: string };

/** POST /api/mobile/auth/google, after the system browser returned to
 *  satisfy://auth?code=... (or ?error=<reason>&email=...). `verifier` is the
 *  PKCE verifier whose S256 challenge the app sent as ?app= when it opened
 *  /auth/google. */
export type GoogleSignInInput = { code: string; verifier: string };
/** The ?error= reasons the browser can hand back. */
export type GoogleSignInError =
  | "google_cancelled"
  | "google_failed"
  | "google_unavailable"
  | "google_unknown"
  | "google_unverified"
  | "inactive";

/** POST /api/mobile/auth/apple. On iOS, the native sign-in: the identity
 *  token Apple gave the app and the nonce whose S256 hash (base64url) the app
 *  passed to Apple. On Android, the browser handoff's code and verifier, as
 *  for Google (the system browser opens /auth/apple?app=<challenge>). A
 *  refusal is a 403 whose error says what to do. */
export type AppleSignInInput = { identityToken: string; nonce: string } | GoogleSignInInput;
/** The ?error= reasons the browser can hand back after Apple sign-in.
 *  `apple_private`: the person hid their email, which matches no volunteer. */
export type AppleSignInError = "apple_cancelled" | "apple_failed" | "apple_unavailable" | "apple_unknown" | "apple_private" | "inactive";

/** POST /api/mobile/auth/passkey/options (sign in) and
 *  POST /api/mobile/passkeys/options (add a passkey, signed in). `options`
 *  is the WebAuthn JSON to hand to the device; send `challengeId` back with
 *  its response. Valid for five minutes, once. */
export type PasskeyOptions<O> = { challengeId: string; options: O };
/** POST /api/mobile/auth/passkey */
export type PasskeySignInInput<R> = { challengeId: string; response: R };
/** POST /api/mobile/passkeys returns MutationOk. */
export type PasskeyRegisterInput<R> = { challengeId: string; response: R; name: string };

/** POST /api/mobile/auth/link: "Forgot your password?" or "First time
 *  here?". Emails a link to set a password on the website. The reply is the
 *  same whether or not the address has an account. Returns MutationOk. */
export type SignInLinkInput = { email: string };

/** POST /api/mobile/apply: the sign-up form, the same as /sign-up on the
 *  website. It sends an application to the coordinator, whose approval
 *  creates the account and emails an invite to set a password. The reply is
 *  the same whether or not the address already has an account (that person
 *  is emailed instead). Returns MutationOk; a 400 has `fields`. */
export type SignUpInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  suburb: string;
  birthYear: number | null;
  /** At least one. */
  interests: VolunteerRole[];
  availability: string;
  emergencyName: string;
  emergencyPhone: string;
  message: string;
  /** Has read the privacy policy. Must be true. */
  privacy: boolean;
};
export type SignUpField = keyof SignUpInput;

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
  /** `fix` says what unblocks it: current training, a role the volunteer
   *  does not hold yet (only a coordinator can add one), or for a harvest,
   *  joining the harvest pool (which they do themselves). */
  | { kind: "BLOCKED"; reason: string; fix: "training" | "role" | "harvestPool"; moduleCode: string | null }
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
  /** Details from the coordinator, e.g. where to park at the orchard. */
  notes: string | null;
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
  /** For harvest pool members: the next harvest they are on, else the
   *  soonest with a place left. `id` is the shift id. */
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

/** GET /api/mobile/training/modules/:code. For an online module, the app
 *  locks the confirmation until `paragraphs` are read to the end and every
 *  link is opened (completionGate in @satisfy/core/training). */
export type TrainingModuleDetail = {
  today: string;
  module: ModuleSummary;
  paragraphs: string[];
  /** Videos (usually YouTube) or pages such as an MPI course, in order. */
  links: ModuleLink[];
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

/** GET /api/mobile/harvest. Harvests are ordinary shifts of kind HARVEST:
 *  book and cancel them with the shift endpoints. Joining the pool (the
 *  HARVEST role) brings in the harvest training, and harvest shifts stay
 *  BLOCKED until it is done. */
export type HarvestOverview = {
  today: string;
  inPool: boolean;
  poolCount: number;
  /** Modules harvests need, with this volunteer's status as if in the pool,
   *  so someone thinking of joining sees what it involves. */
  training: ModuleSummary[];
  /** Every harvest training module is Complete or Due soon. */
  trained: boolean;
  /** Published harvests from today on, soonest first. */
  harvests: ShiftSummary[];
};

/** PUT /api/mobile/harvest/pool with HarvestPoolInput returns MutationOk. */
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

// Sign-in and security -----------------------------------------------------

/** GET /api/mobile/security. Passwords and Google are managed on the
 *  website; passkeys can be added and removed here, since a phone's passkey
 *  has to be created on the phone. Apple can be connected here on iOS, and
 *  disconnected on any phone. */
export type SecurityOverview = {
  hasPassword: boolean;
  google: { email: string | null } | null;
  /** `email` is null when they hid it (an Apple relay address). */
  apple: { email: string | null } | null;
  /** Whether this server offers Sign in with Apple. */
  appleAvailable: boolean;
  passkeys: { id: string; name: string; addedLabel: string; lastUsedLabel: string | null }[];
  /** Whether this server can register passkeys for the app's platform. */
  passkeysAvailable: boolean;
  /** Sign-in and security on the website. */
  manageUrl: string;
};
/** DELETE /api/mobile/passkeys/:id returns MutationOk. */

/** POST /api/mobile/apple connects Apple to the signed-in volunteer from the
 *  iOS app's native sign-in; DELETE disconnects it. Both return MutationOk. */
export type AppleConnectInput = { identityToken: string; nonce: string };

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
