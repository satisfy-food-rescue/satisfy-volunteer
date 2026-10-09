// Pure email builders. Nothing here touches the database, so the seed and the
// server actions share one source of truth for what volunteers would receive.
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
};

const SIGN_OFF = "Ngā mihi nui,\nThe Satisfy volunteer team";
const COORDINATOR_SIGN_OFF = "Satisfy volunteer system";

function paragraphs(...parts: string[]): string {
  return parts.filter(Boolean).join("\n\n");
}

/** Free text typed by the coordinator, ended like a sentence. */
export function sentence(text: string): string {
  return /[.!?]["')]?$/.test(text) ? text : `${text}.`;
}

export function trainingDueSoon(p: {
  firstName: string;
  moduleName: string;
  expiresISO: string;
  daysLeft: number;
  online: boolean;
}): EmailDraft {
  const how = p.online
    ? "It is an online module, so you can read and confirm it in the app in about ten minutes."
    : "Book into the next in-person session from the Training tab in the app.";
  return {
    kind: "TRAINING_DUE_SOON",
    subject: `${p.moduleName} refresher due ${formatDay(p.expiresISO)}`,
    preview: `Your ${p.moduleName} training expires in ${p.daysLeft} days.`,
    body: paragraphs(
      `Kia ora ${p.firstName},`,
      `Your ${p.moduleName} training is due for a refresh on ${formatDate(p.expiresISO)}, which is ${p.daysLeft} days away.`,
      how,
      `Keeping this current means you can keep booking shifts without interruption. Thanks for helping keep everyone safe at the warehouse and on the road.`,
      SIGN_OFF,
    ),
    ctaLabel: p.online ? "Complete the refresher" : "See training sessions",
    ctaHref: "/app/training",
  };
}

export function trainingOverdue(p: {
  firstName: string;
  moduleName: string;
  expiredISO: string;
  online: boolean;
  blocks: string;
}): EmailDraft {
  return {
    kind: "TRAINING_OVERDUE",
    subject: `Action needed: ${p.moduleName} refresher is overdue`,
    preview: `${p.moduleName} expired on ${formatDate(p.expiredISO)}.`,
    body: paragraphs(
      `Kia ora ${p.firstName},`,
      `Your ${p.moduleName} training expired on ${formatDate(p.expiredISO)}. Until it is refreshed you will not be able to book ${p.blocks}. Your existing regular slot is not affected.`,
      p.online
        ? "This one is quick: open the Training tab, read the short refresher and tick the confirmation box. Your record updates straight away."
        : "Please book into the next in-person session from the Training tab, or reply to this email and we will find a time that suits.",
      `We send this reminder weekly while the training is overdue.`,
      SIGN_OFF,
    ),
    ctaLabel: p.online ? "Complete it now" : "Book a session",
    ctaHref: "/app/training",
  };
}

export function shiftReminder(p: {
  firstName: string;
  shiftName: string;
  dateISO: string;
  start: string;
  end: string;
  shiftId: string;
  where: string;
}): EmailDraft {
  return {
    kind: "SHIFT_REMINDER",
    subject: `Reminder: ${p.shiftName} tomorrow, ${formatTimeRange(p.start, p.end)}`,
    preview: `See you ${formatDay(p.dateISO)} at ${p.where}.`,
    body: paragraphs(
      `Kia ora ${p.firstName},`,
      `A quick reminder that you are on ${p.shiftName} tomorrow, ${formatDayLong(p.dateISO)}, ${formatTimeRange(p.start, p.end)} at ${p.where}.`,
      `Wear closed-toe shoes and bring a warm layer. If you can no longer make it, mark yourself away in the app so the shift shows as needing cover.`,
      SIGN_OFF,
    ),
    ctaLabel: "View shift",
    ctaHref: `/app/shifts/${p.shiftId}`,
  };
}

export function absenceConfirmed(p: {
  firstName: string;
  startISO: string;
  endISO: string;
  reasonLabel: string;
  releasedCount: number;
}): EmailDraft {
  const range =
    p.startISO === p.endISO
      ? formatDayLong(p.startISO)
      : `${formatDay(p.startISO)} to ${formatDay(p.endISO)}`;
  return {
    kind: "ABSENCE_CONFIRMED",
    subject: `You are marked away ${range}`,
    preview: `${p.releasedCount} of your shifts have been released for cover.`,
    body: paragraphs(
      `Kia ora ${p.firstName},`,
      `We have you marked away (${p.reasonLabel.toLowerCase()}) ${range}. ${p.releasedCount === 0 ? "None of your regular shifts fall in that period." : `${p.releasedCount} of your regular ${p.releasedCount === 1 ? "shift has" : "shifts have"} been released so other volunteers can cover.`}`,
      `Your regular slot picks up again automatically when you are back. If your plans change, you can shorten or remove the absence in the app.`,
      p.reasonLabel === "Sick" ? "Look after yourself and get well soon." : "Enjoy the break.",
      SIGN_OFF,
    ),
    ctaLabel: "View my slot",
    ctaHref: "/app/slot",
  };
}

export function coverConfirmed(p: {
  firstName: string;
  shiftName: string;
  dateISO: string;
  start: string;
  end: string;
  shiftId: string;
}): EmailDraft {
  return {
    kind: "COVER_CONFIRMED",
    subject: `Thanks for covering ${p.shiftName} on ${formatDay(p.dateISO)}`,
    preview: `You are confirmed ${formatTimeRange(p.start, p.end)}.`,
    body: paragraphs(
      `Kia ora ${p.firstName},`,
      `Ka pai, you are confirmed to cover ${p.shiftName} on ${formatDayLong(p.dateISO)}, ${formatTimeRange(p.start, p.end)}.`,
      `Stepping in when someone is away is what keeps the kai moving. Thank you.`,
      SIGN_OFF,
    ),
    ctaLabel: "View shift",
    ctaHref: `/app/shifts/${p.shiftId}`,
  };
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

/** Sent to everyone booked on a shift the coordinator cancels, alongside
 *  shiftCancelledPush. The email reaches volunteers without the app and
 *  carries the coordinator's reason. */
export function shiftCancelled(p: ShiftCancelledParams): EmailDraft {
  return {
    kind: "SHIFT_CANCELLED",
    subject: `${p.shiftName} on ${formatDay(p.dateISO)} is cancelled`,
    preview: `Your ${formatTimeRange(p.start, p.end)} shift is not going ahead. Please do not come in.`,
    body: paragraphs(
      `Kia ora ${p.firstName},`,
      `Sorry to say ${p.shiftName} on ${formatDayLong(p.dateISO)}, ${formatTimeRange(p.start, p.end)}, has been cancelled, so please do not come in.`,
      p.reason ? `A note from ${p.cancelledBy}: ${sentence(p.reason)}` : "",
      p.regular
        ? `This only affects this one shift. Your regular weekly slot carries on as usual.`
        : `If you would still like to help this week, there may be other shifts open in the app.`,
      `Thanks for being ready to help, and sorry for the change of plans.`,
      SIGN_OFF,
    ),
    ctaLabel: "See other shifts",
    ctaHref: "/app/shifts",
  };
}

export function shiftCancelledPush(p: ShiftCancelledParams): EmailDraft {
  return {
    kind: "SHIFT_CANCELLED",
    channel: "PUSH",
    subject: `Shift cancelled: ${formatDay(p.dateISO)}`,
    preview: `${p.shiftName}, ${formatTimeRange(p.start, p.end)} is not going ahead. Please do not come in.`,
    body: paragraphs(
      `${p.shiftName} on ${formatDayLong(p.dateISO)}, ${formatTimeRange(p.start, p.end)} is not going ahead. Please do not come in.`,
      p.reason ? `A note from ${p.cancelledBy}: ${sentence(p.reason)}` : "",
    ),
    ctaLabel: "Open the shift",
    ctaHref: `/app/shifts/${p.shiftId}`,
  };
}

export function gapAlert(p: {
  shiftName: string;
  dateISO: string;
  start: string;
  end: string;
  cause: string;
  shiftId: string;
}): EmailDraft {
  return {
    kind: "GAP_ALERT",
    subject: `Cover needed: ${p.shiftName}, ${formatDay(p.dateISO)}`,
    preview: p.cause,
    body: paragraphs(
      `${p.shiftName} on ${formatDayLong(p.dateISO)} (${formatTimeRange(p.start, p.end)}) now needs cover.`,
      `Cause: ${p.cause}.`,
      `The shift is listed under Open gaps for eligible volunteers. You can also assign someone from the roster.`,
      COORDINATOR_SIGN_OFF,
    ),
    ctaLabel: "Open the roster",
    ctaHref: `/admin/roster/${p.shiftId}`,
  };
}

export function applicationApproved(p: {
  firstName: string;
  inductionAt?: Date;
  inductionLocation?: string;
}): EmailDraft {
  return {
    kind: "APPLICATION_APPROVED",
    subject: "Welcome to Satisfy Food Rescue",
    preview: "Your volunteer application has been approved.",
    body: paragraphs(
      `Kia ora ${p.firstName},`,
      `Great news, your application to volunteer with Satisfy has been approved. Nau mai, haere mai.`,
      p.inductionAt
        ? `Your first step is your initial visit to the warehouse on ${formatInstant(p.inductionAt)} at ${p.inductionLocation ?? "the Rangiora warehouse"}. We have pencilled you in; please confirm from the Training tab.`
        : `Your first step is your initial visit to the warehouse. Our volunteer coordinator will give you a call to find a time that suits, or you can book one from the Training tab.`,
      `Once your in-person training is complete you can book shifts, choose a regular weekly slot, and opt in to seasonal harvest callouts.`,
      SIGN_OFF,
    ),
    ctaLabel: "Open the volunteer app",
    ctaHref: "/app",
  };
}

export function trainingCompleted(p: {
  firstName: string;
  moduleName: string;
  /** Omitted when completed today. */
  completedISO?: string;
  expiresISO: string | null;
}): EmailDraft {
  return {
    kind: "TRAINING_COMPLETED",
    subject: `${p.moduleName} recorded as complete`,
    preview: p.expiresISO
      ? `Next refresher due ${formatDate(p.expiresISO)}.`
      : "No refresher needed.",
    body: paragraphs(
      `Kia ora ${p.firstName},`,
      `Your ${p.moduleName} training has been recorded as complete${p.completedISO ? `, as of ${formatDate(p.completedISO)}` : " today"}.`,
      p.expiresISO
        ? `Your next refresher will be due on ${formatDate(p.expiresISO)}. We will remind you 30 days beforehand.`
        : `This module does not expire.`,
      SIGN_OFF,
    ),
    ctaLabel: "View my training",
    ctaHref: "/app/training",
  };
}

export function sessionConfirmed(p: {
  firstName: string;
  moduleName: string;
  startsAt: Date;
  location: string;
}): EmailDraft {
  return {
    kind: "SESSION_CONFIRMED",
    subject: `You are booked: ${p.moduleName}, ${formatInstant(p.startsAt)}`,
    preview: `At ${p.location}.`,
    body: paragraphs(
      `Kia ora ${p.firstName},`,
      `You are booked into the ${p.moduleName} session on ${formatInstant(p.startsAt)} at ${p.location}.`,
      `Attendance is marked by the coordinator on the day and your training record updates automatically.`,
      SIGN_OFF,
    ),
    ctaLabel: "View my training",
    ctaHref: "/app/training",
  };
}

export function harvestCallout(p: {
  firstName: string;
  title: string;
  dateISO: string;
  start: string;
  end: string;
  location: string;
  partner: string;
}): EmailDraft {
  return {
    kind: "HARVEST_CALLOUT",
    subject: `Harvest callout: ${p.title}, ${formatDay(p.dateISO)}`,
    preview: `${formatTimeRange(p.start, p.end)} at ${p.location}.`,
    body: paragraphs(
      `Kia ora ${p.firstName},`,
      `We have a harvest on. ${p.title} at ${p.location}, ${formatDayLong(p.dateISO)}, ${formatTimeRange(p.start, p.end)}, with ${p.partner}.`,
      `Bring a hat, sunscreen and water. Ladders and picking bags are provided. Let us know in the app if you can come.`,
      SIGN_OFF,
    ),
    ctaLabel: "Respond to the callout",
    ctaHref: "/app/harvest",
  };
}

export function welcome(p: { firstName: string }): EmailDraft {
  return {
    kind: "WELCOME",
    subject: "Your Satisfy volunteer account is ready",
    preview: "Sign in to see training and shifts.",
    body: paragraphs(
      `Kia ora ${p.firstName},`,
      `Your volunteer account is ready. Sign in to confirm your initial visit, see the weekly shift pattern and add your emergency contact.`,
      SIGN_OFF,
    ),
    ctaLabel: "Sign in",
    ctaHref: "/app",
  };
}

export function initialVisitBooked(p: {
  firstName: string;
  startsAt: Date;
  location: string;
  bookedBy: string;
}): EmailDraft {
  return {
    kind: "SESSION_CONFIRMED",
    subject: `Your initial visit: ${formatInstant(p.startsAt)}`,
    preview: `At ${p.location}.`,
    body: paragraphs(
      `Kia ora ${p.firstName},`,
      `Thanks for the chat. As agreed with ${p.bookedBy}, your initial visit to Satisfy is on ${formatInstant(p.startsAt)} at ${p.location}.`,
      `We will show you around the warehouse, go through health and safety, and answer any questions. Wear closed-toe shoes and bring a warm layer. If the time no longer suits, reply to this email and we will find another.`,
      SIGN_OFF,
    ),
    ctaLabel: "View my training",
    ctaHref: "/app/training",
  };
}

export function lastMinuteCallout(p: {
  shiftName: string;
  dateISO: string;
  start: string;
  end: string;
  shiftId: string;
}): EmailDraft {
  return {
    kind: "LAST_MINUTE_CALLOUT",
    channel: "PUSH",
    subject: `Can you help ${formatDay(p.dateISO)}?`,
    preview: `${p.shiftName}, ${formatTimeRange(p.start, p.end)} needs cover. Tap to take it.`,
    body: `${p.shiftName} on ${formatDayLong(p.dateISO)}, ${formatTimeRange(p.start, p.end)} needs cover. Tap to take it.`,
    ctaLabel: "Open the shift",
    ctaHref: `/app/shifts/${p.shiftId}`,
  };
}

export function gapEscalation(p: {
  shiftName: string;
  dateISO: string;
  start: string;
  end: string;
  cause: string;
  notified: number;
  shiftId: string;
}): EmailDraft {
  return {
    kind: "GAP_ESCALATION",
    subject: `Still uncovered: ${p.shiftName}, ${formatDay(p.dateISO)}`,
    preview: "Nobody has taken this shift yet. Time to pick up the phone.",
    body: paragraphs(
      `${p.shiftName} on ${formatDayLong(p.dateISO)} (${formatTimeRange(p.start, p.end)}) is still uncovered.`,
      `Cause: ${p.cause}.`,
      p.notified > 0
        ? `${p.notified} last-minute ${p.notified === 1 ? "volunteer was" : "volunteers were"} sent a push notification and nobody has taken it. The shift page lists who is free and eligible, with phone numbers.`
        : `No eligible last-minute volunteers were free to notify. The shift page lists everyone else who is free and eligible, with phone numbers.`,
      COORDINATOR_SIGN_OFF,
    ),
    ctaLabel: "Find cover",
    ctaHref: `/admin/roster/${p.shiftId}`,
  };
}

export function rolesChanged(p: {
  volunteerName: string;
  volunteerId: string;
  changedBy: string;
  added: string[];
  removed: string[];
  trainingNeeded: string[];
}): EmailDraft {
  const parts = [
    p.added.length ? `added ${p.added.join(", ")}` : "",
    p.removed.length ? `removed ${p.removed.join(", ")}` : "",
  ].filter(Boolean);
  return {
    kind: "ROLES_CHANGED",
    subject: `Roles changed for ${p.volunteerName}`,
    preview: `${p.changedBy} ${parts.join(" and ")}.`,
    body: paragraphs(
      `${p.changedBy} changed ${p.volunteerName}'s roles: ${parts.join(" and ")}.`,
      p.trainingNeeded.length
        ? `Training now needed before they can book these shifts: ${p.trainingNeeded.join(", ")}.`
        : `No extra training is needed for the new roles.`,
      COORDINATOR_SIGN_OFF,
    ),
    ctaLabel: "Open their profile",
    ctaHref: `/admin/volunteers/${p.volunteerId}`,
  };
}

export function roleChangeRequest(p: {
  volunteerName: string;
  volunteerId: string;
  message: string;
}): EmailDraft {
  return {
    kind: "ROLE_CHANGE_REQUEST",
    subject: `${p.volunteerName} would like to change roles`,
    preview: p.message,
    body: paragraphs(
      `${p.volunteerName} asked for a change to their volunteer roles from the app:`,
      `"${p.message}"`,
      `Roles decide which shifts they can book and which training applies, so changes are made by a coordinator from their profile.`,
      COORDINATOR_SIGN_OFF,
    ),
    ctaLabel: "Open their profile",
    ctaHref: `/admin/volunteers/${p.volunteerId}`,
  };
}
