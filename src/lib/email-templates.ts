// The automatic messages. Each is a template: default wording with
// {placeholders}, written once here, and a builder that works out the values
// (dates, names, the sentence that depends on the case) and fills it in.
// Coordinators can replace the wording of any of them from Admin > Emails
// (EmailTemplate rows); queueEmail() swaps their wording in when the message
// is sent, using the values the builder recorded on the draft. Nothing here
// touches the database, so the seed and the server actions share one source
// of truth for what volunteers would receive.
//
// The text rules, for the defaults and for coordinators' wording alike:
// paragraphs are separated by a blank line, a single line break stays inside
// a paragraph, and a paragraph with an empty placeholder is left out, so a
// detail that is not there (no note, no phone number) takes its sentence
// with it.
import type { Channel, EmailKind } from "./domain";
import { formatDate, formatDay, formatDayLong, formatInstant, formatTimeRange } from "./dates";

export type EmailDraft = {
  kind: EmailKind;
  /** Defaults to EMAIL. A PUSH draft is a phone notification: the subject is
   *  the title and the preview is the one-line message. */
  channel?: Channel;
  subject: string;
  preview: string;
  body: string;
  ctaLabel?: string;
  ctaHref?: string;
  /** The template it came from and the values for its placeholders, so a
   *  coordinator's wording can replace the default when it is sent. */
  template?: { key: TemplateKey; values: Record<string, string> };
};

/** Who reads it, which also picks the email footer. */
export type TemplateAudience = "volunteer" | "coordinator" | "applicant";

/** The editable parts of a message. */
export type TemplateText = { subject: string; preview: string; body: string; ctaLabel?: string };

export type TemplateSpec = TemplateText & {
  key: string;
  kind: EmailKind;
  channel: Channel;
  /** What coordinators call it in the admin. */
  name: string;
  audience: TemplateAudience;
  /** When it is sent, for the admin. */
  when: string;
  /** Each placeholder and what it is filled with. */
  placeholders: Record<string, string>;
  /** Values for the admin preview. */
  sample: Record<string, string>;
};

const SIGN_OFF = "Ngā mihi nui,\nThe Satisfy volunteer team";
const COORDINATOR_SIGN_OFF = "Satisfy volunteer system";

/** Free text typed by the coordinator, ended like a sentence. */
export function sentence(text: string): string {
  return /[.!?]["')]?$/.test(text) ? text : `${text}.`;
}

const PLACEHOLDER = /\{(\w+)\}/g;

/** The placeholders a piece of text uses, in order, once each. */
export function placeholdersIn(text: string): string[] {
  return [...new Set([...text.matchAll(PLACEHOLDER)].map((m) => m[1]!))];
}

function fillLine(text: string, values: Record<string, string>): string {
  return text.replace(PLACEHOLDER, (whole, name: string) => (name in values ? values[name]! : whole));
}

/** Fills a message body: paragraphs with an empty placeholder are left out. */
function fillBody(text: string, values: Record<string, string>): string {
  return text
    .split(/\r?\n\s*\r?\n/)
    .filter((p) => !placeholdersIn(p).some((name) => values[name] === ""))
    .map((p) => fillLine(p.trim(), values))
    .filter(Boolean)
    .join("\n\n");
}

/** The message a template's text makes with these values. */
export function renderText(text: TemplateText, values: Record<string, string>): TemplateText {
  return {
    subject: fillLine(text.subject, values).trim(),
    preview: fillLine(text.preview, values).trim(),
    body: fillBody(text.body, values),
    ...(text.ctaLabel ? { ctaLabel: fillLine(text.ctaLabel, values).trim() } : {}),
  };
}

function spec<const K extends string, const P extends string>(s: Omit<TemplateSpec, "key" | "placeholders" | "sample"> & { key: K; placeholders: Record<P, string>; sample: Record<P, string> }) {
  return s;
}

type Values<S extends { placeholders: Record<string, string> }> = Record<keyof S["placeholders"], string>;

/** Builds a draft from a template's default wording. `ctaHref` is where the
 *  button goes (sign-in links are added when sent, so they have none);
 *  `button: false` drops the button for this message. */
function build<S extends TemplateSpec>(s: S, values: Values<S>, extra: { kind?: EmailKind; ctaHref?: string; button?: boolean } = {}): EmailDraft {
  const text = renderText(s, values);
  const button = extra.button !== false && text.ctaLabel;
  return {
    kind: extra.kind ?? s.kind,
    ...(s.channel === "PUSH" ? { channel: "PUSH" as const } : {}),
    subject: text.subject,
    preview: text.preview,
    body: text.body,
    ...(button ? { ctaLabel: text.ctaLabel } : {}),
    ...(button && extra.ctaHref ? { ctaHref: extra.ctaHref } : {}),
    template: { key: s.key as TemplateKey, values },
  };
}

// Placeholder descriptions used by several templates.
const FIRST_NAME = "The volunteer's first name";
const SHIFT_NAME = "The shift, e.g. Warehouse sorting (AM)";
const DAY = "The day, e.g. Tue 3 Nov";
const LONG_DATE = "The date in full, e.g. Tuesday 3 November";
const TIME = "The time, e.g. 9am - 12pm";
const SAMPLE_SHIFT = { shiftName: "Warehouse sorting (AM)", day: "Tue 10 Nov", date: "Tuesday 10 November", time: "9am - 12pm" };

// ---------------------------------------------------------------------------
// Training
// ---------------------------------------------------------------------------

const TRAINING_DUE_SOON = spec({
  key: "training-due-soon",
  kind: "TRAINING_DUE_SOON",
  channel: "EMAIL",
  name: "Training due soon",
  audience: "volunteer",
  when: "30 days before a module they need runs out.",
  placeholders: { firstName: FIRST_NAME, moduleName: "The module", dueDay: DAY, dueDate: "The expiry date in full", daysLeft: "Days until it runs out", howToRefresh: "How to refresh it: online in the app, or at an in-person session", button: "Complete the refresher, or See training sessions" },
  sample: { firstName: "Margaret", moduleName: "Manual Handling", dueDay: "Fri 4 Dec", dueDate: "4 December 2026", daysLeft: "30", howToRefresh: "It is an online module, so you can read and confirm it in the app in about ten minutes.", button: "Complete the refresher" },
  subject: "{moduleName} refresher due {dueDay}",
  preview: "Your {moduleName} training expires in {daysLeft} days.",
  body: `Kia ora {firstName},\n\nYour {moduleName} training is due for a refresh on {dueDate}, which is {daysLeft} days away.\n\n{howToRefresh}\n\nKeeping this current means you can keep booking shifts without interruption. Thanks for helping keep everyone safe at the warehouse and on the road.\n\n${SIGN_OFF}`,
  ctaLabel: "{button}",
});

export function trainingDueSoon(p: { firstName: string; moduleName: string; expiresISO: string; daysLeft: number; online: boolean }): EmailDraft {
  return build(
    TRAINING_DUE_SOON,
    {
      firstName: p.firstName,
      moduleName: p.moduleName,
      dueDay: formatDay(p.expiresISO),
      dueDate: formatDate(p.expiresISO),
      daysLeft: String(p.daysLeft),
      howToRefresh: p.online ? "It is an online module, so you can read and confirm it in the app in about ten minutes." : "Book into the next in-person session from the Training tab in the app.",
      button: p.online ? "Complete the refresher" : "See training sessions",
    },
    { ctaHref: "/app/training" },
  );
}

const TRAINING_OVERDUE = spec({
  key: "training-overdue",
  kind: "TRAINING_OVERDUE",
  channel: "EMAIL",
  name: "Training overdue",
  audience: "volunteer",
  when: "When a module runs out, then weekly until it is refreshed.",
  placeholders: { firstName: FIRST_NAME, moduleName: "The module", expiredDate: "The date it ran out", blocks: "What it blocks: new shifts, or route shifts", howToRefresh: "How to refresh it: online in the app, or at an in-person session", button: "Complete it now, or Book a session" },
  sample: { firstName: "Tony", moduleName: "Manual Handling", expiredDate: "20 October 2026", blocks: "new shifts", howToRefresh: "This one is quick: open the Training tab, read the short refresher and tick the confirmation box. Your record updates straight away.", button: "Complete it now" },
  subject: "Action needed: {moduleName} refresher is overdue",
  preview: "{moduleName} expired on {expiredDate}.",
  body: `Kia ora {firstName},\n\nYour {moduleName} training expired on {expiredDate}. Until it is refreshed you will not be able to book {blocks}. Your existing regular slot is not affected.\n\n{howToRefresh}\n\nWe send this reminder weekly while the training is overdue.\n\n${SIGN_OFF}`,
  ctaLabel: "{button}",
});

export function trainingOverdue(p: { firstName: string; moduleName: string; expiredISO: string; online: boolean; blocks: string }): EmailDraft {
  return build(
    TRAINING_OVERDUE,
    {
      firstName: p.firstName,
      moduleName: p.moduleName,
      expiredDate: formatDate(p.expiredISO),
      blocks: p.blocks,
      howToRefresh: p.online
        ? "This one is quick: open the Training tab, read the short refresher and tick the confirmation box. Your record updates straight away."
        : "Please book into the next in-person session from the Training tab, or reply to this email and we will find a time that suits.",
      button: p.online ? "Complete it now" : "Book a session",
    },
    { ctaHref: "/app/training" },
  );
}

const TRAINING_OVERDUE_COORDINATOR = spec({
  key: "training-overdue-coordinator",
  kind: "TRAINING_OVERDUE_COORDINATOR",
  channel: "EMAIL",
  name: "Training three weeks overdue",
  audience: "coordinator",
  when: "When a volunteer's training is three weeks overdue.",
  placeholders: { volunteerName: "The volunteer's full name", moduleName: "The module", expiredDate: "The date it ran out", phone: "Their phone number, when they have one" },
  sample: { volunteerName: "Tony Ratana", moduleName: "Manual Handling", expiredDate: "20 October 2026", phone: "021 555 0142" },
  subject: "{volunteerName}: {moduleName} three weeks overdue",
  preview: "Expired {expiredDate}. Weekly reminders have not worked yet.",
  body: `{volunteerName}'s {moduleName} training expired on {expiredDate} and is still not refreshed after three weekly reminders.\n\nUntil it is done they cannot book the shifts it covers. Their regular slot is not affected. A quick call usually sorts it.\n\nTheir phone: {phone}\n\n${COORDINATOR_SIGN_OFF}`,
  ctaLabel: "Open their profile",
});

export function trainingOverdueCoordinator(p: { volunteerName: string; volunteerId: string; moduleName: string; expiredISO: string; phone: string | null }): EmailDraft {
  return build(
    TRAINING_OVERDUE_COORDINATOR,
    { volunteerName: p.volunteerName, moduleName: p.moduleName, expiredDate: formatDate(p.expiredISO), phone: p.phone ?? "" },
    { ctaHref: `/admin/volunteers/${p.volunteerId}` },
  );
}

const TRAINING_COMPLETED = spec({
  key: "training-completed",
  kind: "TRAINING_COMPLETED",
  channel: "EMAIL",
  name: "Training completed",
  audience: "volunteer",
  when: "When they complete a module, or you record it for them.",
  placeholders: { firstName: FIRST_NAME, moduleName: "The module", completedWhen: "today, or as of the date it happened", nextRefresher: "When the next refresher is due, or that none is needed", expiryNote: "The sentence about expiry" },
  sample: { firstName: "Jess", moduleName: "Manual Handling", completedWhen: "today", nextRefresher: "Next refresher due 5 November 2027.", expiryNote: "Your next refresher will be due on 5 November 2027. We will remind you 30 days beforehand." },
  subject: "{moduleName} recorded as complete",
  preview: "{nextRefresher}",
  body: `Kia ora {firstName},\n\nYour {moduleName} training has been recorded as complete {completedWhen}.\n\n{expiryNote}\n\n${SIGN_OFF}`,
  ctaLabel: "View my training",
});

export function trainingCompleted(p: { firstName: string; moduleName: string; /** Omitted when completed today. */ completedISO?: string; expiresISO: string | null }): EmailDraft {
  return build(
    TRAINING_COMPLETED,
    {
      firstName: p.firstName,
      moduleName: p.moduleName,
      completedWhen: p.completedISO ? `as of ${formatDate(p.completedISO)}` : "today",
      nextRefresher: p.expiresISO ? `Next refresher due ${formatDate(p.expiresISO)}.` : "No refresher needed.",
      expiryNote: p.expiresISO ? `Your next refresher will be due on ${formatDate(p.expiresISO)}. We will remind you 30 days beforehand.` : "This module does not expire.",
    },
    { ctaHref: "/app/training" },
  );
}

const SESSION_CONFIRMED = spec({
  key: "session-confirmed",
  kind: "SESSION_CONFIRMED",
  channel: "EMAIL",
  name: "Training session booked",
  audience: "volunteer",
  when: "When they book into a training session.",
  placeholders: { firstName: FIRST_NAME, moduleName: "The module", when: "The day and time", location: "Where it is" },
  sample: { firstName: "Jess", moduleName: "Route and Vehicle Safety", when: "Thu 12 Nov, 10:30am", location: "Satisfy warehouse, Rangiora" },
  subject: "You are booked: {moduleName}, {when}",
  preview: "At {location}.",
  body: `Kia ora {firstName},\n\nYou are booked into the {moduleName} session on {when} at {location}.\n\nAttendance is marked by the coordinator on the day and your training record updates automatically.\n\n${SIGN_OFF}`,
  ctaLabel: "View my training",
});

export function sessionConfirmed(p: { firstName: string; moduleName: string; startsAt: Date; location: string }): EmailDraft {
  return build(SESSION_CONFIRMED, { firstName: p.firstName, moduleName: p.moduleName, when: formatInstant(p.startsAt), location: p.location }, { ctaHref: "/app/training" });
}

const INITIAL_VISIT_BOOKED = spec({
  key: "initial-visit-booked",
  kind: "SESSION_CONFIRMED",
  channel: "EMAIL",
  name: "Initial visit booked",
  audience: "volunteer",
  when: "When you book their initial visit, usually during the welcome call.",
  placeholders: { firstName: FIRST_NAME, when: "The day and time", location: "Where it is", bookedBy: "Your first name" },
  sample: { firstName: "Jess", when: "Mon 9 Nov, 10am", location: "Satisfy warehouse, Rangiora", bookedBy: "Phillipa" },
  subject: "Your initial visit: {when}",
  preview: "At {location}.",
  body: `Kia ora {firstName},\n\nThanks for the chat. As agreed with {bookedBy}, your initial visit to Satisfy is on {when} at {location}.\n\nWe will show you around the warehouse, go through health and safety, and answer any questions. Wear closed-toe shoes and bring a warm layer. If the time no longer suits, reply to this email and we will find another.\n\n${SIGN_OFF}`,
  ctaLabel: "View my training",
});

export function initialVisitBooked(p: { firstName: string; startsAt: Date; location: string; bookedBy: string }): EmailDraft {
  return build(INITIAL_VISIT_BOOKED, { firstName: p.firstName, when: formatInstant(p.startsAt), location: p.location, bookedBy: p.bookedBy }, { ctaHref: "/app/training" });
}

// ---------------------------------------------------------------------------
// Induction: Ministry of Justice check, agreements and policies
// ---------------------------------------------------------------------------

const MOJ_CHECK_RECORDED = spec({
  key: "moj-check-recorded",
  kind: "MOJ_CHECK_RECORDED",
  channel: "EMAIL",
  name: "Ministry of Justice check recorded",
  audience: "volunteer",
  when: "When you record a volunteer's Ministry of Justice check.",
  placeholders: { firstName: FIRST_NAME, checkedDate: "The date on the check", renewalDate: "When it needs renewing, three years on", nextStep: "What they can do next" },
  sample: { firstName: "Jess", checkedDate: "2 November 2026", renewalDate: "2 November 2029", nextStep: "Your induction is complete, so you can start your training." },
  subject: "Your Ministry of Justice check is recorded",
  preview: "Thanks. It is valid until {renewalDate}.",
  body: `Kia ora {firstName},\n\nThanks for sending your Ministry of Justice check. We have recorded it, dated {checkedDate}. It needs renewing every three years, so we will remind you before {renewalDate}.\n\n{nextStep}\n\n${SIGN_OFF}`,
  ctaLabel: "Open the volunteer app",
});

export function mojCheckRecorded(p: { firstName: string; checkedISO: string; renewsISO: string; inductionComplete: boolean }): EmailDraft {
  return build(
    MOJ_CHECK_RECORDED,
    {
      firstName: p.firstName,
      checkedDate: formatDate(p.checkedISO),
      renewalDate: formatDate(p.renewsISO),
      nextStep: p.inductionComplete ? "Your induction is complete, so you can start your training." : "There is a little more to do before your training: open the app to see what is left.",
    },
    { ctaHref: "/app/induction" },
  );
}

const MOJ_RENEWAL_DUE = spec({
  key: "moj-renewal-due",
  kind: "MOJ_CHECK_RENEWAL",
  channel: "EMAIL",
  name: "Ministry of Justice check due for renewal",
  audience: "volunteer",
  when: "60 days before their check is three years old.",
  placeholders: { firstName: FIRST_NAME, renewalDate: "When it needs renewing", checkUrl: "The Ministry's page for requesting your own check" },
  sample: { firstName: "Margaret", renewalDate: "4 January 2027", checkUrl: "https://www.justice.govt.nz/criminal-records/get-your-own/" },
  subject: "Time to renew your Ministry of Justice check",
  preview: "Your check needs renewing by {renewalDate}.",
  body: `Kia ora {firstName},\n\nYour Ministry of Justice check is three years old on {renewalDate}, so it is time to request a new one. It is free, done online, and the Ministry can take up to 20 working days to send it back, so it is worth starting now.\n\nRequest it at {checkUrl} and forward the result to us when it arrives.\n\nNo computer or scanner? That is fine: talk to the volunteer coordinator and we will do it together.\n\n${SIGN_OFF}`,
  ctaLabel: "How to renew it",
});

export function mojRenewalDue(p: { firstName: string; renewsISO: string; checkUrl: string }): EmailDraft {
  return build(MOJ_RENEWAL_DUE, { firstName: p.firstName, renewalDate: formatDate(p.renewsISO), checkUrl: p.checkUrl }, { ctaHref: "/app/induction" });
}

const MOJ_EXPIRED = spec({
  key: "moj-expired",
  kind: "MOJ_CHECK_RENEWAL",
  channel: "EMAIL",
  name: "Ministry of Justice check expired",
  audience: "volunteer",
  when: "When their check turns three years old without a new one.",
  placeholders: { firstName: FIRST_NAME, renewalDate: "When it ran out", checkUrl: "The Ministry's page for requesting your own check" },
  sample: { firstName: "Margaret", renewalDate: "4 November 2026", checkUrl: "https://www.justice.govt.nz/criminal-records/get-your-own/" },
  subject: "Action needed: your Ministry of Justice check has run out",
  preview: "Your check ran out on {renewalDate}.",
  body: `Kia ora {firstName},\n\nYour Ministry of Justice check ran out on {renewalDate}. Until we have a new one you will not be able to book new shifts. Your existing regular slot is not affected.\n\nRequest it at {checkUrl} and forward the result to us when it arrives.\n\nNo computer or scanner? That is fine: talk to the volunteer coordinator and we will do it together.\n\n${SIGN_OFF}`,
  ctaLabel: "How to renew it",
});

export function mojExpired(p: { firstName: string; renewsISO: string; checkUrl: string }): EmailDraft {
  return build(MOJ_EXPIRED, { firstName: p.firstName, renewalDate: formatDate(p.renewsISO), checkUrl: p.checkUrl }, { ctaHref: "/app/induction" });
}

const MOJ_RENEWAL_COORDINATOR = spec({
  key: "moj-renewal-coordinator",
  kind: "MOJ_CHECK_RENEWAL_COORDINATOR",
  channel: "EMAIL",
  name: "Ministry of Justice check due (to you)",
  audience: "coordinator",
  when: "60 days before a volunteer's check is three years old, and again if it runs out.",
  placeholders: { volunteerName: "The volunteer's full name", status: "due for renewal on a date, or ran out on a date", phone: "Their phone number, when they have one" },
  sample: { volunteerName: "Margaret Fairweather", status: "is due for renewal on 4 January 2027", phone: "021 555 0101" },
  subject: "{volunteerName}: Ministry of Justice check renewal",
  preview: "Their check {status}.",
  body: `{volunteerName}'s Ministry of Justice check {status}. They have been emailed how to request a new one.\n\nWhen it arrives, record the new date on their profile. Some volunteers need a hand with the online form or scanning: a quick call helps.\n\nTheir phone: {phone}\n\n${COORDINATOR_SIGN_OFF}`,
  ctaLabel: "Open their profile",
});

export function mojRenewalCoordinator(p: { volunteerName: string; volunteerId: string; renewsISO: string; expired: boolean; phone: string | null }): EmailDraft {
  return build(
    MOJ_RENEWAL_COORDINATOR,
    { volunteerName: p.volunteerName, status: p.expired ? `ran out on ${formatDate(p.renewsISO)}` : `is due for renewal on ${formatDate(p.renewsISO)}`, phone: p.phone ?? "" },
    { ctaHref: `/admin/volunteers/${p.volunteerId}` },
  );
}

const DOCUMENT_PLACEHOLDERS = { firstName: FIRST_NAME, title: "The document's title", note: "What changed, as you wrote it when publishing" };

const POLICY_UPDATED = spec({
  key: "policy-updated",
  kind: "DOCUMENT_UPDATED",
  channel: "EMAIL",
  name: "Policy to read",
  audience: "volunteer",
  when: "When you add a policy or publish a new version, and choose to tell volunteers.",
  placeholders: DOCUMENT_PLACEHOLDERS,
  sample: { firstName: "Margaret", title: "Health and Safety Policy", note: "The section on the loading bay has changed." },
  subject: "Please read: {title}",
  preview: "The latest version is in the volunteer app.",
  body: `Kia ora {firstName},\n\nWe have published the latest {title}.\n\n{note}\n\nPlease read it in the volunteer app and tick to confirm you have read it. It only takes a minute.\n\n${SIGN_OFF}`,
  ctaLabel: "Read it now",
});

const POLICY_UPDATED_PUSH = spec({
  key: "policy-updated-push",
  kind: "DOCUMENT_UPDATED",
  channel: "PUSH",
  name: "Policy to read (push)",
  audience: "volunteer",
  when: "With the email, to volunteers with the app on their phone.",
  placeholders: DOCUMENT_PLACEHOLDERS,
  sample: POLICY_UPDATED.sample,
  subject: "Please read: {title}",
  preview: "The latest version is in the app. Tap to read it.",
  body: "We have published the latest {title}. Please read it and tick to confirm you have read it.\n\n{note}",
  ctaLabel: "Read it now",
});

const AGREEMENT_UPDATED = spec({
  key: "agreement-updated",
  kind: "DOCUMENT_UPDATED",
  channel: "EMAIL",
  name: "Agreement to sign",
  audience: "volunteer",
  when: "When you add an agreement or publish a new version, and choose to tell volunteers.",
  placeholders: DOCUMENT_PLACEHOLDERS,
  sample: { firstName: "Margaret", title: "Volunteer Agreement", note: "We have added a section on photos at events." },
  subject: "Please sign: {title}",
  preview: "Sign it in the app before your next booking.",
  body: `Kia ora {firstName},\n\nWe have published the latest {title}.\n\n{note}\n\nPlease read it and sign it in the volunteer app. Until you do, you will not be able to book new shifts. Your existing regular slot is not affected.\n\n${SIGN_OFF}`,
  ctaLabel: "Read and sign",
});

const AGREEMENT_UPDATED_PUSH = spec({
  key: "agreement-updated-push",
  kind: "DOCUMENT_UPDATED",
  channel: "PUSH",
  name: "Agreement to sign (push)",
  audience: "volunteer",
  when: "With the email, to volunteers with the app on their phone.",
  placeholders: DOCUMENT_PLACEHOLDERS,
  sample: AGREEMENT_UPDATED.sample,
  subject: "Please sign: {title}",
  preview: "Sign it in the app before your next booking.",
  body: "We have published the latest {title}. Please read it and sign it in the app before your next booking.\n\n{note}",
  ctaLabel: "Read and sign",
});

type DocumentUpdatedParams = { firstName: string; title: string; note: string | null; agreement: boolean; documentId: string };

export function documentUpdated(p: DocumentUpdatedParams): EmailDraft {
  const values = { firstName: p.firstName, title: p.title, note: p.note ? sentence(p.note) : "" };
  return build(p.agreement ? AGREEMENT_UPDATED : POLICY_UPDATED, values, { ctaHref: p.agreement ? "/app/induction" : `/app/policies/${p.documentId}` });
}

export function documentUpdatedPush(p: DocumentUpdatedParams): EmailDraft {
  const values = { firstName: p.firstName, title: p.title, note: p.note ? sentence(p.note) : "" };
  return build(p.agreement ? AGREEMENT_UPDATED_PUSH : POLICY_UPDATED_PUSH, values, { ctaHref: p.agreement ? "/app/induction" : `/app/policies/${p.documentId}` });
}

// ---------------------------------------------------------------------------
// Shifts
// ---------------------------------------------------------------------------

const SHIFT_REMINDER = spec({
  key: "shift-reminder",
  kind: "SHIFT_REMINDER",
  channel: "EMAIL",
  name: "Shift reminder",
  audience: "volunteer",
  when: "4pm the day before each shift.",
  placeholders: { firstName: FIRST_NAME, shiftName: SHIFT_NAME, day: DAY, date: LONG_DATE, time: TIME, place: "Where it is" },
  sample: { firstName: "Margaret", ...SAMPLE_SHIFT, place: "Satisfy warehouse, Rangiora" },
  subject: "Reminder: {shiftName} tomorrow, {time}",
  preview: "See you {day} at {place}.",
  body: `Kia ora {firstName},\n\nA quick reminder that you are on {shiftName} tomorrow, {date}, {time} at {place}.\n\nWear closed-toe shoes and bring a warm layer. If you can no longer make it, mark yourself away in the app so the shift shows as needing cover.\n\n${SIGN_OFF}`,
  ctaLabel: "View shift",
});

export function shiftReminder(p: { firstName: string; shiftName: string; dateISO: string; start: string; end: string; shiftId: string; where: string }): EmailDraft {
  return build(
    SHIFT_REMINDER,
    { firstName: p.firstName, shiftName: p.shiftName, day: formatDay(p.dateISO), date: formatDayLong(p.dateISO), time: formatTimeRange(p.start, p.end), place: p.where },
    { ctaHref: `/app/shifts/${p.shiftId}` },
  );
}

const ABSENCE_CONFIRMED = spec({
  key: "absence-confirmed",
  kind: "ABSENCE_CONFIRMED",
  channel: "EMAIL",
  name: "Absence confirmed",
  audience: "volunteer",
  when: "When they mark themselves away, or you record it for them.",
  placeholders: { firstName: FIRST_NAME, dates: "The day or days away", reason: "holiday, sick or other", releasedCount: "How many shifts were released", released: "The sentence about released shifts", closing: "Get well soon, or Enjoy the break" },
  sample: { firstName: "Margaret", dates: "Tue 10 Nov to Fri 13 Nov", reason: "holiday", releasedCount: "2", released: "2 of your regular shifts have been released so other volunteers can cover.", closing: "Enjoy the break." },
  subject: "You are marked away {dates}",
  preview: "{releasedCount} of your shifts have been released for cover.",
  body: `Kia ora {firstName},\n\nWe have you marked away ({reason}) {dates}. {released}\n\nYour regular slot picks up again automatically when you are back. If your plans change, you can shorten or remove the absence in the app.\n\n{closing}\n\n${SIGN_OFF}`,
  ctaLabel: "View my slot",
});

export function absenceConfirmed(p: { firstName: string; startISO: string; endISO: string; reasonLabel: string; releasedCount: number }): EmailDraft {
  return build(
    ABSENCE_CONFIRMED,
    {
      firstName: p.firstName,
      dates: p.startISO === p.endISO ? formatDayLong(p.startISO) : `${formatDay(p.startISO)} to ${formatDay(p.endISO)}`,
      reason: p.reasonLabel.toLowerCase(),
      releasedCount: String(p.releasedCount),
      released: p.releasedCount === 0 ? "None of your regular shifts fall in that period." : `${p.releasedCount} of your regular ${p.releasedCount === 1 ? "shift has" : "shifts have"} been released so other volunteers can cover.`,
      closing: p.reasonLabel === "Sick" ? "Look after yourself and get well soon." : "Enjoy the break.",
    },
    { ctaHref: "/app/slot" },
  );
}

const COVER_CONFIRMED = spec({
  key: "cover-confirmed",
  kind: "COVER_CONFIRMED",
  channel: "EMAIL",
  name: "Cover confirmed",
  audience: "volunteer",
  when: "When they take a shift that needed cover.",
  placeholders: { firstName: FIRST_NAME, shiftName: SHIFT_NAME, day: DAY, date: LONG_DATE, time: TIME },
  sample: { firstName: "Tony", ...SAMPLE_SHIFT },
  subject: "Thanks for covering {shiftName} on {day}",
  preview: "You are confirmed {time}.",
  body: `Kia ora {firstName},\n\nKa pai, you are confirmed to cover {shiftName} on {date}, {time}.\n\nStepping in when someone is away is what keeps the kai moving. Thank you.\n\n${SIGN_OFF}`,
  ctaLabel: "View shift",
});

export function coverConfirmed(p: { firstName: string; shiftName: string; dateISO: string; start: string; end: string; shiftId: string }): EmailDraft {
  return build(
    COVER_CONFIRMED,
    { firstName: p.firstName, shiftName: p.shiftName, day: formatDay(p.dateISO), date: formatDayLong(p.dateISO), time: formatTimeRange(p.start, p.end) },
    { ctaHref: `/app/shifts/${p.shiftId}` },
  );
}

type ShiftCancelledParams = {
  firstName: string;
  shiftName: string;
  dateISO: string;
  start: string;
  end: string;
  shiftId: string;
  /** Their regular weekly slot, so the email can say the slot carries on. */
  regular: boolean;
  /** The coordinator's first name. */
  cancelledBy: string;
  reason?: string;
};

const CANCELLED_PLACEHOLDERS = { firstName: FIRST_NAME, shiftName: SHIFT_NAME, day: DAY, date: LONG_DATE, time: TIME, cancelledBy: "Your first name", reason: "Your reason, when you gave one", afterNote: "That their regular slot carries on, or that other shifts may be open" };
const CANCELLED_SAMPLE = { firstName: "Margaret", ...SAMPLE_SHIFT, cancelledBy: "Phillipa", reason: "The chiller is being repaired.", afterNote: "This only affects this one shift. Your regular weekly slot carries on as usual." };

const SHIFT_CANCELLED = spec({
  key: "shift-cancelled",
  kind: "SHIFT_CANCELLED",
  channel: "EMAIL",
  name: "Shift cancelled",
  audience: "volunteer",
  when: "When you cancel a shift they are booked on.",
  placeholders: CANCELLED_PLACEHOLDERS,
  sample: CANCELLED_SAMPLE,
  subject: "{shiftName} on {day} is cancelled",
  preview: "Your {time} shift is not going ahead. Please do not come in.",
  body: `Kia ora {firstName},\n\nSorry to say {shiftName} on {date}, {time}, has been cancelled, so please do not come in.\n\nA note from {cancelledBy}: {reason}\n\n{afterNote}\n\nThanks for being ready to help, and sorry for the change of plans.\n\n${SIGN_OFF}`,
  ctaLabel: "See other shifts",
});

const SHIFT_CANCELLED_PUSH = spec({
  key: "shift-cancelled-push",
  kind: "SHIFT_CANCELLED",
  channel: "PUSH",
  name: "Shift cancelled (push)",
  audience: "volunteer",
  when: "With the email, to volunteers with the app on their phone.",
  placeholders: CANCELLED_PLACEHOLDERS,
  sample: CANCELLED_SAMPLE,
  subject: "Shift cancelled: {day}",
  preview: "{shiftName}, {time} is not going ahead. Please do not come in.",
  body: "{shiftName} on {date}, {time} is not going ahead. Please do not come in.\n\nA note from {cancelledBy}: {reason}",
  ctaLabel: "Open the shift",
});

function cancelledValues(p: ShiftCancelledParams) {
  return {
    firstName: p.firstName,
    shiftName: p.shiftName,
    day: formatDay(p.dateISO),
    date: formatDayLong(p.dateISO),
    time: formatTimeRange(p.start, p.end),
    cancelledBy: p.cancelledBy,
    reason: p.reason ? sentence(p.reason) : "",
    afterNote: p.regular ? "This only affects this one shift. Your regular weekly slot carries on as usual." : "If you would still like to help this week, there may be other shifts open in the app.",
  };
}

/** Sent to everyone booked on a shift the coordinator cancels, alongside
 *  shiftCancelledPush. The email reaches volunteers without the app and
 *  carries the coordinator's reason. */
export function shiftCancelled(p: ShiftCancelledParams): EmailDraft {
  return build(SHIFT_CANCELLED, cancelledValues(p), { ctaHref: "/app/shifts" });
}

export function shiftCancelledPush(p: ShiftCancelledParams): EmailDraft {
  return build(SHIFT_CANCELLED_PUSH, cancelledValues(p), { ctaHref: `/app/shifts/${p.shiftId}` });
}

type ShiftCalloutParams = {
  firstName: string;
  /** "Harvest" for the harvest pool, else the shift type, e.g. "Driver help". */
  kindLabel: string;
  harvest: boolean;
  name: string;
  dateISO: string;
  start: string;
  end: string;
  location: string;
  notes: string | null;
  spotsLeft: number;
  shiftId: string;
};

const CALLOUT_PLACEHOLDERS = { firstName: FIRST_NAME, name: "The shift's title, e.g. Apple picking", kind: "The kind of shift, e.g. driver help", day: DAY, date: LONG_DATE, time: TIME, location: "Where it is", notes: "Your notes for volunteers, when there are some", places: "Places left, e.g. 3 places" };
const CALLOUT_SAMPLE = { firstName: "Margaret", name: "Apple picking", kind: "harvest", day: "Sat 14 Nov", date: "Saturday 14 November", time: "9am - 12pm", location: "Loburn orchard, 112 Hodgsons Road", notes: "Park by the shed.", places: "6 places" };

const HARVEST_CALLOUT = spec({
  key: "harvest-callout",
  kind: "HARVEST_CALLOUT",
  channel: "EMAIL",
  name: "Harvest callout",
  audience: "volunteer",
  when: "When you publish a harvest with a callout, to the whole harvest pool.",
  placeholders: CALLOUT_PLACEHOLDERS,
  sample: CALLOUT_SAMPLE,
  subject: "Harvest: {name}, {day}",
  preview: "{time} at {location}. {places} to fill.",
  body: `Kia ora {firstName},\n\nWe have a harvest on and would love your help: {name} on {date}, {time}, at {location}.\n\n{notes}\n\nBring a hat, sunscreen and water. If it is your first harvest, we will run through a short induction on the day. Harvest training needs to be done in the app before you can sign up.\n\nPlaces go to whoever signs up first. If it is not for you this time, no need to reply.\n\n${SIGN_OFF}`,
  ctaLabel: "Sign up",
});

const HARVEST_CALLOUT_PUSH = spec({
  key: "harvest-callout-push",
  kind: "HARVEST_CALLOUT",
  channel: "PUSH",
  name: "Harvest callout (push)",
  audience: "volunteer",
  when: "With the email, to harvest pool members with the app on their phone.",
  placeholders: CALLOUT_PLACEHOLDERS,
  sample: CALLOUT_SAMPLE,
  subject: "Harvest: {day}",
  preview: "{name}, {time} at {location}. Tap to sign up.",
  body: "{name} on {date}, {time} at {location}. Tap to sign up.",
  ctaLabel: "Open the shift",
});

const SHIFT_PUBLISHED = spec({
  key: "shift-published",
  kind: "SHIFT_PUBLISHED",
  channel: "EMAIL",
  name: "New shift callout",
  audience: "volunteer",
  when: "When you publish a one-off shift with a callout, to everyone with the role.",
  placeholders: CALLOUT_PLACEHOLDERS,
  sample: { ...CALLOUT_SAMPLE, name: "Extra sorting morning", kind: "warehouse sorting", location: "Satisfy warehouse, Rangiora", notes: "", places: "4 places" },
  subject: "New shift: {name}, {day}",
  preview: "{time} at {location}. {places} to fill.",
  body: `Kia ora {firstName},\n\nA new {kind} shift is up: {name} on {date}, {time}, at {location}.\n\n{notes}\n\nPlaces go to whoever signs up first. If it is not for you this time, no need to reply.\n\n${SIGN_OFF}`,
  ctaLabel: "Sign up",
});

const SHIFT_PUBLISHED_PUSH = spec({
  key: "shift-published-push",
  kind: "SHIFT_PUBLISHED",
  channel: "PUSH",
  name: "New shift callout (push)",
  audience: "volunteer",
  when: "With the email, to volunteers with the app on their phone.",
  placeholders: CALLOUT_PLACEHOLDERS,
  sample: SHIFT_PUBLISHED.sample,
  subject: "New shift: {day}",
  preview: "{name}, {time} at {location}. Tap to sign up.",
  body: "{name} on {date}, {time} at {location}. Tap to sign up.",
  ctaLabel: "Open the shift",
});

function calloutValues(p: ShiftCalloutParams) {
  return {
    firstName: p.firstName,
    name: p.name,
    kind: p.kindLabel.toLowerCase(),
    day: formatDay(p.dateISO),
    date: formatDayLong(p.dateISO),
    time: formatTimeRange(p.start, p.end),
    location: p.location,
    notes: p.notes ? sentence(p.notes) : "",
    places: `${p.spotsLeft} ${p.spotsLeft === 1 ? "place" : "places"}`,
  };
}

/** Sent when a coordinator publishes a one-off shift and asks for a callout:
 *  to every active volunteer who holds the role (for a harvest, the whole
 *  harvest pool, trained or not, since the email says how to get ready). */
export function shiftCallout(p: ShiftCalloutParams): EmailDraft {
  return build(p.harvest ? HARVEST_CALLOUT : SHIFT_PUBLISHED, calloutValues(p), { ctaHref: `/app/shifts/${p.shiftId}` });
}

export function shiftCalloutPush(p: ShiftCalloutParams): EmailDraft {
  return build(p.harvest ? HARVEST_CALLOUT_PUSH : SHIFT_PUBLISHED_PUSH, calloutValues(p), { ctaHref: `/app/shifts/${p.shiftId}` });
}

type ShiftAddedParams = {
  firstName: string;
  shiftName: string;
  dateISO: string;
  start: string;
  end: string;
  location: string;
  shiftId: string;
  /** The coordinator's first name. */
  addedBy: string;
  /** Filling a gap rather than an open place. */
  covering: boolean;
};

const ADDED_PLACEHOLDERS = { firstName: FIRST_NAME, shiftName: SHIFT_NAME, day: DAY, date: LONG_DATE, time: TIME, location: "Where it is", addedBy: "Your first name", coverNote: "A thank you for covering, when it fills a gap" };
const ADDED_SAMPLE = { firstName: "Tony", ...SAMPLE_SHIFT, location: "Satisfy warehouse, Rangiora", addedBy: "Phillipa", coverNote: "You are covering for someone who is away. Stepping in is what keeps the kai moving, thank you." };

const SHIFT_ADDED = spec({
  key: "shift-added",
  kind: "SHIFT_ADDED",
  channel: "EMAIL",
  name: "Added to a shift",
  audience: "volunteer",
  when: "When you put them on a shift.",
  placeholders: ADDED_PLACEHOLDERS,
  sample: ADDED_SAMPLE,
  subject: "You're on {shiftName}, {day}",
  preview: "{addedBy} added you: {time} at {location}.",
  body: `Kia ora {firstName},\n\n{addedBy} has added you to {shiftName} on {date}, {time}, at {location}.\n\n{coverNote}\n\nIf you can no longer make it, cancel it in the app or reply to this email so we can find someone else.\n\n${SIGN_OFF}`,
  ctaLabel: "View shift",
});

const SHIFT_ADDED_PUSH = spec({
  key: "shift-added-push",
  kind: "SHIFT_ADDED",
  channel: "PUSH",
  name: "Added to a shift (push)",
  audience: "volunteer",
  when: "With the email, to volunteers with the app on their phone.",
  placeholders: ADDED_PLACEHOLDERS,
  sample: ADDED_SAMPLE,
  subject: "You're on {day}",
  preview: "{addedBy} added you to {shiftName}, {time}.",
  body: "{addedBy} added you to {shiftName} on {date}, {time}, at {location}.",
  ctaLabel: "Open the shift",
});

function addedValues(p: ShiftAddedParams) {
  return {
    firstName: p.firstName,
    shiftName: p.shiftName,
    day: formatDay(p.dateISO),
    date: formatDayLong(p.dateISO),
    time: formatTimeRange(p.start, p.end),
    location: p.location,
    addedBy: p.addedBy,
    coverNote: p.covering ? "You are covering for someone who is away. Stepping in is what keeps the kai moving, thank you." : "",
  };
}

/** Sent when a coordinator puts a volunteer on a shift, usually after a phone
 *  call, so the booking is in writing and on their phone. */
export function shiftAdded(p: ShiftAddedParams): EmailDraft {
  return build(SHIFT_ADDED, addedValues(p), { kind: p.covering ? "COVER_CONFIRMED" : "SHIFT_ADDED", ctaHref: `/app/shifts/${p.shiftId}` });
}

export function shiftAddedPush(p: ShiftAddedParams): EmailDraft {
  return build(SHIFT_ADDED_PUSH, addedValues(p), { kind: p.covering ? "COVER_CONFIRMED" : "SHIFT_ADDED", ctaHref: `/app/shifts/${p.shiftId}` });
}

const LAST_MINUTE_CALLOUT = spec({
  key: "last-minute-callout",
  kind: "LAST_MINUTE_CALLOUT",
  channel: "PUSH",
  name: "Last-minute cover (push)",
  audience: "volunteer",
  when: "When a gap opens inside the shift type's last-minute window, to last-minute volunteers who are free.",
  placeholders: { shiftName: SHIFT_NAME, day: DAY, date: LONG_DATE, time: TIME },
  sample: SAMPLE_SHIFT,
  subject: "Can you help {day}?",
  preview: "{shiftName}, {time} needs cover. Tap to take it.",
  body: "{shiftName} on {date}, {time} needs cover. Tap to take it.",
  ctaLabel: "Open the shift",
});

export function lastMinuteCallout(p: { shiftName: string; dateISO: string; start: string; end: string; shiftId: string }): EmailDraft {
  return build(
    LAST_MINUTE_CALLOUT,
    { shiftName: p.shiftName, day: formatDay(p.dateISO), date: formatDayLong(p.dateISO), time: formatTimeRange(p.start, p.end) },
    { ctaHref: `/app/shifts/${p.shiftId}` },
  );
}

const GAP_PLACEHOLDERS = { shiftName: SHIFT_NAME, day: DAY, date: LONG_DATE, time: TIME, cause: "Why it is short, e.g. Brian Tweedie away" };
const GAP_SAMPLE = { ...SAMPLE_SHIFT, cause: "Brian Tweedie away (holiday)" };

const GAP_ALERT = spec({
  key: "gap-alert",
  kind: "GAP_ALERT",
  channel: "EMAIL",
  name: "Coverage gap alert",
  audience: "coordinator",
  when: "As soon as an absence or cancellation leaves a shift short.",
  placeholders: GAP_PLACEHOLDERS,
  sample: GAP_SAMPLE,
  subject: "Cover needed: {shiftName}, {day}",
  preview: "{cause}",
  body: `{shiftName} on {date} ({time}) now needs cover.\n\nCause: {cause}.\n\nThe shift is listed under Open gaps for eligible volunteers. You can also assign someone from the roster.\n\n${COORDINATOR_SIGN_OFF}`,
  ctaLabel: "Open the roster",
});

export function gapAlert(p: { shiftName: string; dateISO: string; start: string; end: string; cause: string; shiftId: string }): EmailDraft {
  return build(
    GAP_ALERT,
    { shiftName: p.shiftName, day: formatDay(p.dateISO), date: formatDayLong(p.dateISO), time: formatTimeRange(p.start, p.end), cause: p.cause },
    { ctaHref: `/admin/roster/${p.shiftId}` },
  );
}

const GAP_ESCALATION = spec({
  key: "gap-escalation",
  kind: "GAP_ESCALATION",
  channel: "EMAIL",
  name: "Uncovered shift alert",
  audience: "coordinator",
  when: "When a shift is still short at the shift type's alert threshold.",
  placeholders: { ...GAP_PLACEHOLDERS, notified: "Who was sent a last-minute notification" },
  sample: { ...GAP_SAMPLE, notified: "3 last-minute volunteers were sent a push notification and nobody has taken it. The shift page lists who is free and eligible, with phone numbers." },
  subject: "Still uncovered: {shiftName}, {day}",
  preview: "Nobody has taken this shift yet. Time to pick up the phone.",
  body: `{shiftName} on {date} ({time}) is still uncovered.\n\nCause: {cause}.\n\n{notified}\n\n${COORDINATOR_SIGN_OFF}`,
  ctaLabel: "Find cover",
});

export function gapEscalation(p: { shiftName: string; dateISO: string; start: string; end: string; cause: string; notified: number; shiftId: string }): EmailDraft {
  return build(
    GAP_ESCALATION,
    {
      shiftName: p.shiftName,
      day: formatDay(p.dateISO),
      date: formatDayLong(p.dateISO),
      time: formatTimeRange(p.start, p.end),
      cause: p.cause,
      notified:
        p.notified > 0
          ? `${p.notified} last-minute ${p.notified === 1 ? "volunteer was" : "volunteers were"} sent a push notification and nobody has taken it. The shift page lists who is free and eligible, with phone numbers.`
          : "No eligible last-minute volunteers were free to notify. The shift page lists everyone else who is free and eligible, with phone numbers.",
    },
    { ctaHref: `/admin/roster/${p.shiftId}` },
  );
}

// ---------------------------------------------------------------------------
// Announcements: the coordinator's own words, so not a template
// ---------------------------------------------------------------------------

type AnnouncementParams = {
  firstName: string;
  subject: string;
  /** Paragraphs separated by a blank line, as the coordinator typed them. */
  body: string;
  /** The coordinator's first name. */
  from: string;
  /** Set when it is about one shift, so the button opens it. */
  shiftId?: string;
};

export function announcement(p: AnnouncementParams): EmailDraft {
  const firstLine = p.body.split("\n").find((l) => l.trim()) ?? "";
  return {
    kind: "ANNOUNCEMENT",
    subject: p.subject,
    preview: firstLine.length > 120 ? `${firstLine.slice(0, 117).trimEnd()}...` : firstLine,
    body: [`Kia ora ${p.firstName},`, p.body.trim(), `Ngā mihi nui,\n${p.from} and the Satisfy volunteer team`].join("\n\n"),
    ...(p.shiftId ? { ctaLabel: "View shift", ctaHref: `/app/shifts/${p.shiftId}` } : {}),
  };
}

export function announcementPush(p: AnnouncementParams): EmailDraft {
  const email = announcement(p);
  return { ...email, channel: "PUSH", body: p.body.trim(), ctaLabel: p.shiftId ? "Open the shift" : undefined, ctaHref: p.shiftId ? `/app/shifts/${p.shiftId}` : undefined };
}

// ---------------------------------------------------------------------------
// Signing up and accounts
// ---------------------------------------------------------------------------

const APPLICATION_RECEIVED = spec({
  key: "application-received",
  kind: "APPLICATION_RECEIVED",
  channel: "EMAIL",
  name: "Application received",
  audience: "applicant",
  when: "When someone signs up to volunteer.",
  placeholders: { firstName: "Their first name" },
  sample: { firstName: "Aroha" },
  subject: "Thanks for signing up to volunteer",
  preview: "We have your application. Here is what happens next.",
  body: `Kia ora {firstName},\n\nThanks for signing up to volunteer with Satisfy Food Rescue. We have your application, and our volunteer coordinator will be in touch soon.\n\nOnce you are approved, we will email you a link to set up your account in the Satisfy volunteer app, and give you a call to book your initial visit to the warehouse, where you meet the team and get shown around.\n\nIf anything changes in the meantime, just reply to this email.\n\n${SIGN_OFF}`,
});

/** Sent to someone who has just signed up to volunteer. They have no account
 *  until the coordinator approves them. */
export function applicationReceived(p: { firstName: string }): EmailDraft {
  return build(APPLICATION_RECEIVED, { firstName: p.firstName });
}

const ALREADY_REGISTERED = spec({
  key: "already-registered",
  kind: "ALREADY_REGISTERED",
  channel: "EMAIL",
  name: "Already has an account",
  audience: "volunteer",
  when: "When someone signs up with an email that already has an account.",
  placeholders: { firstName: FIRST_NAME },
  sample: { firstName: "Margaret" },
  subject: "You already have a Satisfy account",
  preview: "Sign in with this email address. There is nothing more to fill in.",
  body: `Kia ora {firstName},\n\nSomeone, hopefully you, just used the volunteer sign-up form with this email address. You already have a Satisfy account, so there is nothing more to fill in.\n\nSign in with this email address to see your shifts and training. If you have never set a password, or have forgotten it, choose "Forgot your password?" on the sign-in page and we will email you a link.\n\nNot you? You can ignore this email.\n\n${SIGN_OFF}`,
  ctaLabel: "Sign in",
});

/** Sent instead of a confirmation when someone signs up with an email address
 *  that already has an account, so the form never says which addresses do. */
export function alreadyRegistered(p: { firstName: string }): EmailDraft {
  return build(ALREADY_REGISTERED, { firstName: p.firstName }, { ctaHref: "/sign-in" });
}

const APPLICATION_NEW = spec({
  key: "application-new",
  kind: "APPLICATION_NEW",
  channel: "EMAIL",
  name: "New application",
  audience: "coordinator",
  when: "When a new application is waiting for review.",
  placeholders: { name: "Their full name", suburb: "Their suburb", source: "website or app", interests: "The roles they are interested in", availability: "When they are free, as they wrote it", message: "Their message, when they left one" },
  sample: { name: "Aroha Ngata", suburb: "Kaiapoi", source: "website", interests: "Warehouse sorting, Harvest", availability: "Monday mornings.", message: "I used to work in a supermarket." },
  subject: "New volunteer application from {name}",
  preview: "{interests}. {availability}",
  body: `{name} from {suburb} signed up to volunteer on the {source}.\n\nInterested in: {interests}.\n\nAvailability: {availability}\n\nTheir message: "{message}"\n\nApproving the application creates their account and emails them an invite to sign in.\n\n${COORDINATOR_SIGN_OFF}`,
  ctaLabel: "Review the application",
});

/** Tells the coordinator a new application is waiting for review. */
export function applicationNew(p: { applicationId: string; name: string; source: "website" | "app"; suburb: string; interests: string[]; availability: string; message: string | null }): EmailDraft {
  return build(
    APPLICATION_NEW,
    { name: p.name, suburb: p.suburb, source: p.source, interests: p.interests.join(", "), availability: sentence(p.availability), message: p.message ?? "" },
    { ctaHref: `/admin/applications#${p.applicationId}` },
  );
}

const APPLICATION_APPROVED = spec({
  key: "application-approved",
  kind: "APPLICATION_APPROVED",
  channel: "EMAIL",
  name: "Application approved",
  audience: "volunteer",
  when: "When you approve their application.",
  placeholders: { firstName: FIRST_NAME, firstStep: "Their first step: the initial visit" },
  sample: { firstName: "Jess", firstStep: "Your first step is your initial visit to the warehouse. Our volunteer coordinator will give you a call to find a time that suits, or you can book one from the Training tab." },
  subject: "Welcome to Satisfy Food Rescue",
  preview: "Your volunteer application has been approved.",
  body: `Kia ora {firstName},\n\nGreat news, your application to volunteer with Satisfy has been approved. Nau mai, haere mai.\n\n{firstStep}\n\nOnce your in-person training is complete you can book shifts, choose a regular weekly slot, and join the harvest pool for seasonal picking.\n\n${SIGN_OFF}`,
  ctaLabel: "Open the volunteer app",
});

export function applicationApproved(p: { firstName: string; inductionAt?: Date; inductionLocation?: string }): EmailDraft {
  return build(
    APPLICATION_APPROVED,
    {
      firstName: p.firstName,
      firstStep: p.inductionAt
        ? `Your first step is your initial visit to the warehouse on ${formatInstant(p.inductionAt)} at ${p.inductionLocation ?? "the Rangiora warehouse"}. We have pencilled you in; please confirm from the Training tab.`
        : "Your first step is your initial visit to the warehouse. Our volunteer coordinator will give you a call to find a time that suits, or you can book one from the Training tab.",
    },
    { ctaHref: "/app" },
  );
}

const INVITE_PLACEHOLDERS = { firstName: "Their first name", days: "How many days the link works" };

const ACCOUNT_INVITE = spec({
  key: "account-invite",
  kind: "ACCOUNT_INVITE",
  channel: "EMAIL",
  name: "Volunteer account invite",
  audience: "volunteer",
  when: "When a volunteer account is made for them. The button signs them in.",
  placeholders: INVITE_PLACEHOLDERS,
  sample: { firstName: "Jess", days: "7" },
  subject: "Set up your Satisfy volunteer account",
  preview: "Choose a password to sign in. The link works for {days} days.",
  body: `Kia ora {firstName},\n\nYour Satisfy volunteer account is ready. Choose a password to sign in and see your training, shifts and regular slot.\n\nThe link works once and for {days} days. If this address is your Google account, you can also just sign in with Google.\n\nNot expecting this? You can ignore it.\n\n${SIGN_OFF}`,
  ctaLabel: "Set up my account",
});

const COORDINATOR_INVITE = spec({
  key: "coordinator-invite",
  kind: "ACCOUNT_INVITE",
  channel: "EMAIL",
  name: "Coordinator account invite",
  audience: "volunteer",
  when: "When a coordinator account is made for someone. The button signs them in.",
  placeholders: INVITE_PLACEHOLDERS,
  sample: { firstName: "Aroha", days: "7" },
  subject: "Set up your Satisfy coordinator account",
  preview: "Choose a password to sign in. The link works for {days} days.",
  body: `Kia ora {firstName},\n\nYou have been given a coordinator account for the Satisfy volunteer system. Choose a password to sign in to the coordinator admin, where you run the roster, look after volunteers and their training, and send messages.\n\nThe link works once and for {days} days. If this address is your Google account, you can also just sign in with Google.\n\nNot expecting this? You can ignore it.\n\n${SIGN_OFF}`,
  ctaLabel: "Set up my account",
});

/** Sent when an admin creates an account. The button carries a single-use
 *  link that is never stored, so the logged copy has no link. A coordinator
 *  account gets its own wording, since it opens the admin, not the app. */
export function accountInvite(p: { firstName: string; expiresDays: number; coordinator?: boolean }): EmailDraft {
  return build(p.coordinator ? COORDINATOR_INVITE : ACCOUNT_INVITE, { firstName: p.firstName, days: String(p.expiresDays) });
}

const RESET_PLACEHOLDERS = { firstName: FIRST_NAME, hours: "How many hours the link works" };

const PASSWORD_RESET = spec({
  key: "password-reset",
  kind: "PASSWORD_RESET",
  channel: "EMAIL",
  name: "Password reset",
  audience: "volunteer",
  when: "When someone with a password asks to reset it. The button signs them in.",
  placeholders: RESET_PLACEHOLDERS,
  sample: { firstName: "Margaret", hours: "2" },
  subject: "Reset your Satisfy volunteer password",
  preview: "The link works once and for {hours} hours.",
  body: `Kia ora {firstName},\n\nSomeone, hopefully you, asked to reset the password for your Satisfy volunteer account.\n\nThe button below works once and for {hours} hours. If you did not ask for this, ignore this email: your password has not changed.\n\n${SIGN_OFF}`,
  ctaLabel: "Choose a new password",
});

const PASSWORD_SET = spec({
  key: "password-set",
  kind: "PASSWORD_RESET",
  channel: "EMAIL",
  name: "Choose a password",
  audience: "volunteer",
  when: "When someone without a password asks for one (First time here?). The button signs them in.",
  placeholders: RESET_PLACEHOLDERS,
  sample: { firstName: "Jess", hours: "2" },
  subject: "Choose a password for Satisfy volunteers",
  preview: "The link works once and for {hours} hours.",
  body: `Kia ora {firstName},\n\nSomeone, hopefully you, asked to set up a password for your Satisfy volunteer account.\n\nThe button below works once and for {hours} hours. If you did not ask for this, ignore this email.\n\n${SIGN_OFF}`,
  ctaLabel: "Choose a password",
});

/** "Forgot password" and "first time here?" both send this. */
export function passwordReset(p: { firstName: string; expiresHours: number; hasPassword: boolean }): EmailDraft {
  return build(p.hasPassword ? PASSWORD_RESET : PASSWORD_SET, { firstName: p.firstName, hours: String(p.expiresHours) });
}

const ADMIN_ACCESS_GRANTED = spec({
  key: "admin-access-granted",
  kind: "ADMIN_ACCESS",
  channel: "EMAIL",
  name: "Made a coordinator",
  audience: "volunteer",
  when: "When a volunteer who already signs in is made a coordinator.",
  placeholders: { firstName: FIRST_NAME, grantedBy: "Your first name" },
  sample: { firstName: "Margaret", grantedBy: "Phillipa" },
  subject: "You are now a Satisfy coordinator",
  preview: "{grantedBy} gave you access to the coordinator admin.",
  body: `Kia ora {firstName},\n\n{grantedBy} has made you a coordinator in the Satisfy volunteer system. Sign in as usual and you will go straight to the coordinator admin, where you run the roster, look after volunteers and their training, and send messages.\n\nYou are still a volunteer too, so your regular slot, shifts and training carry on as before. The volunteer app is a click away in the admin.\n\nNot expecting this? Let {grantedBy} know.\n\n${SIGN_OFF}`,
  ctaLabel: "Open the coordinator admin",
});

/** Sent to someone who already signs in when they are made a coordinator.
 *  They keep volunteering. */
export function adminAccessGranted(p: { firstName: string; grantedBy: string }): EmailDraft {
  return build(ADMIN_ACCESS_GRANTED, { firstName: p.firstName, grantedBy: p.grantedBy }, { ctaHref: "/admin" });
}

const ADMIN_ACCESS_REMOVED = spec({
  key: "admin-access-removed",
  kind: "ADMIN_ACCESS",
  channel: "EMAIL",
  name: "Coordinator access removed",
  audience: "volunteer",
  when: "When a coordinator's access is removed.",
  placeholders: { firstName: FIRST_NAME, removedBy: "Your first name" },
  sample: { firstName: "Aroha", removedBy: "Phillipa" },
  subject: "Your Satisfy coordinator access has been removed",
  preview: "{removedBy} removed your access to the coordinator admin.",
  body: `Kia ora {firstName},\n\n{removedBy} has removed your coordinator access to the Satisfy volunteer system. Your account stays open as a volunteer account, so you can still sign in to the volunteer app.\n\nThink this is a mistake? Let {removedBy} know.\n\n${SIGN_OFF}`,
  ctaLabel: "Open the volunteer app",
});

/** Sent when a coordinator's access is removed. The account stays open as a
 *  volunteer account. */
export function adminAccessRemoved(p: { firstName: string; removedBy: string }): EmailDraft {
  return build(ADMIN_ACCESS_REMOVED, { firstName: p.firstName, removedBy: p.removedBy }, { ctaHref: "/app" });
}

const ROLES_CHANGED = spec({
  key: "roles-changed",
  kind: "ROLES_CHANGED",
  channel: "EMAIL",
  name: "Roles changed",
  audience: "coordinator",
  when: "When a coordinator changes a volunteer's roles.",
  placeholders: { volunteerName: "The volunteer's full name", changedBy: "Who changed them", changes: "What was added and removed", trainingNote: "Training the new roles need, if any" },
  sample: { volunteerName: "Tony Ratana", changedBy: "Phillipa Smith", changes: "added Volunteer driver", trainingNote: "Training now needed before they can book these shifts: Driver Licence Check." },
  subject: "Roles changed for {volunteerName}",
  preview: "{changedBy} {changes}.",
  body: `{changedBy} changed {volunteerName}'s roles: {changes}.\n\n{trainingNote}\n\n${COORDINATOR_SIGN_OFF}`,
  ctaLabel: "Open their profile",
});

export function rolesChanged(p: { volunteerName: string; volunteerId: string; changedBy: string; added: string[]; removed: string[]; trainingNeeded: string[] }): EmailDraft {
  const changes = [p.added.length ? `added ${p.added.join(", ")}` : "", p.removed.length ? `removed ${p.removed.join(", ")}` : ""].filter(Boolean).join(" and ");
  return build(
    ROLES_CHANGED,
    {
      volunteerName: p.volunteerName,
      changedBy: p.changedBy,
      changes,
      trainingNote: p.trainingNeeded.length ? `Training now needed before they can book these shifts: ${p.trainingNeeded.join(", ")}.` : "No extra training is needed for the new roles.",
    },
    { ctaHref: `/admin/volunteers/${p.volunteerId}` },
  );
}

const ROLE_CHANGE_REQUEST = spec({
  key: "role-change-request",
  kind: "ROLE_CHANGE_REQUEST",
  channel: "EMAIL",
  name: "Role change request",
  audience: "coordinator",
  when: "When a volunteer asks to change roles from the app.",
  placeholders: { volunteerName: "The volunteer's full name", message: "What they asked for" },
  sample: { volunteerName: "Margaret Fairweather", message: "I would like to try driver help on Thursdays." },
  subject: "{volunteerName} would like to change roles",
  preview: "{message}",
  body: `{volunteerName} asked for a change to their volunteer roles from the app:\n\n"{message}"\n\nRoles decide which shifts they can book and which training applies, so changes are made by a coordinator from their profile.\n\n${COORDINATOR_SIGN_OFF}`,
  ctaLabel: "Open their profile",
});

export function roleChangeRequest(p: { volunteerName: string; volunteerId: string; message: string }): EmailDraft {
  return build(ROLE_CHANGE_REQUEST, { volunteerName: p.volunteerName, message: p.message }, { ctaHref: `/admin/volunteers/${p.volunteerId}` });
}

const ACCOUNT_DELETED = spec({
  key: "account-deleted",
  kind: "ACCOUNT_DELETED",
  channel: "EMAIL",
  name: "Volunteer deleted their account",
  audience: "coordinator",
  when: "When a volunteer deletes their own account.",
  placeholders: { volunteerName: "Their name, for the last time", released: "What they came off, if anything" },
  sample: { volunteerName: "Sam Collins", released: "They came off 1 regular slot and 2 upcoming shifts, which now need cover." },
  subject: "{volunteerName} deleted their volunteer account",
  preview: "{released}",
  body: `{volunteerName} deleted their Satisfy volunteer account, from the app or the website.\n\n{released}\n\nTheir personal details have been removed and they have been signed out everywhere. The shifts and training they completed stay in the records without their name. If they would like to volunteer again, they can sign up afresh.\n\n${COORDINATOR_SIGN_OFF}`,
  ctaLabel: "Open the roster",
});

/** To the coordinator when a volunteer deletes their own account. Their
 *  details are already gone, so this names them one last time. */
export function accountDeleted(p: { volunteerName: string; releasedShifts: number; releasedSlots: number }): EmailDraft {
  const released = [
    p.releasedSlots > 0 && `${p.releasedSlots} regular ${p.releasedSlots === 1 ? "slot" : "slots"}`,
    p.releasedShifts > 0 && `${p.releasedShifts} upcoming ${p.releasedShifts === 1 ? "shift, which now needs" : "shifts, which now need"} cover`,
  ].filter(Boolean);
  return build(
    ACCOUNT_DELETED,
    { volunteerName: p.volunteerName, released: released.length ? `They came off ${released.join(" and ")}.` : "They were not on a regular slot or any upcoming shift." },
    { ctaHref: "/admin/roster", button: p.releasedShifts > 0 },
  );
}

// ---------------------------------------------------------------------------
// Coordinators' wording
// ---------------------------------------------------------------------------

export type TextField = keyof TemplateText;

/** What is wrong with a coordinator's wording for a template, per field, or
 *  null when it can be saved: every part filled in, and only the
 *  template's own placeholders. */
export function wordingProblems(spec: Pick<TemplateSpec, "placeholders" | "ctaLabel">, text: TemplateText): Partial<Record<TextField, string>> | null {
  const problems: Partial<Record<TextField, string>> = {};
  const known = Object.keys(spec.placeholders);
  const limits: Record<TextField, number> = { subject: 150, preview: 200, body: 5000, ctaLabel: 40 };
  for (const field of ["subject", "preview", "body", "ctaLabel"] as const) {
    if (field === "ctaLabel" && !spec.ctaLabel) continue;
    const value = (text[field] ?? "").trim();
    if (!value) {
      problems[field] = "This cannot be empty.";
      continue;
    }
    if (value.length > limits[field]) {
      problems[field] = `Keep it under ${limits[field]} characters.`;
      continue;
    }
    const unknown = placeholdersIn(value).filter((p) => !known.includes(p));
    if (unknown.length) problems[field] = `${unknown.map((p) => `{${p}}`).join(", ")} ${unknown.length === 1 ? "is not a placeholder" : "are not placeholders"} this message has.`;
  }
  return Object.keys(problems).length ? problems : null;
}

// ---------------------------------------------------------------------------
// The registry, for Admin > Emails and the outbox
// ---------------------------------------------------------------------------

export const TEMPLATES = [
  SHIFT_REMINDER,
  ABSENCE_CONFIRMED,
  COVER_CONFIRMED,
  LAST_MINUTE_CALLOUT,
  SHIFT_ADDED,
  SHIFT_ADDED_PUSH,
  SHIFT_CANCELLED,
  SHIFT_CANCELLED_PUSH,
  SHIFT_PUBLISHED,
  SHIFT_PUBLISHED_PUSH,
  HARVEST_CALLOUT,
  HARVEST_CALLOUT_PUSH,
  TRAINING_DUE_SOON,
  TRAINING_OVERDUE,
  TRAINING_COMPLETED,
  SESSION_CONFIRMED,
  INITIAL_VISIT_BOOKED,
  MOJ_CHECK_RECORDED,
  MOJ_RENEWAL_DUE,
  MOJ_EXPIRED,
  POLICY_UPDATED,
  POLICY_UPDATED_PUSH,
  AGREEMENT_UPDATED,
  AGREEMENT_UPDATED_PUSH,
  APPLICATION_RECEIVED,
  ALREADY_REGISTERED,
  APPLICATION_APPROVED,
  ACCOUNT_INVITE,
  COORDINATOR_INVITE,
  PASSWORD_RESET,
  PASSWORD_SET,
  ADMIN_ACCESS_GRANTED,
  ADMIN_ACCESS_REMOVED,
  GAP_ALERT,
  GAP_ESCALATION,
  APPLICATION_NEW,
  TRAINING_OVERDUE_COORDINATOR,
  MOJ_RENEWAL_COORDINATOR,
  ROLE_CHANGE_REQUEST,
  ROLES_CHANGED,
  ACCOUNT_DELETED,
] as const satisfies readonly TemplateSpec[];

export type TemplateKey = (typeof TEMPLATES)[number]["key"];

export function templateByKey(key: string): TemplateSpec | null {
  return TEMPLATES.find((t) => t.key === key) ?? null;
}
