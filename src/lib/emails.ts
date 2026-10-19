import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { after } from "next/server";
import type { Email } from "@/generated/prisma/client";
import { db } from "./db";
import type { EmailDraft } from "./email-templates";
import { fullName } from "./domain";
import { env, isDemo } from "./env";
import { sendEmail } from "./mailer";
import { pushToVolunteer } from "./push";

// The outbox. Every message is written to the Email table first (it drives
// the Outbox page, each volunteer's communication history and the reminder
// de-duplication refs), then delivered after the response so a slow provider
// never holds up a button press: emails through Resend, push notifications
// through Expo to the volunteer's phones. Anything that fails is retried by
// the hourly job (sweepOutbox).
//
// In demo mode emails are recorded as CAPTURED and never sent. Pushes still
// reach phones signed in to the demo, which is how it is shown to people.

/** A volunteer. */
export type Recipient = { id: string; firstName: string; lastName?: string | null; email: string };
/** Someone who has applied to volunteer and has no account yet. */
export type ApplicantRecipient = { applicationId: string; firstName: string; lastName?: string | null; email: string };

const capturing = new AsyncLocalStorage<true>();

/** Runs `fn` with every message recorded as CAPTURED instead of sent. The
 *  demo seed uses it so generating demo data never emails or pushes. */
export function withCapturedEmails<T>(fn: () => Promise<T>): Promise<T> {
  return capturing.run(true, fn);
}

function seeding(): boolean {
  return capturing.getStore() === true;
}

const MAX_ATTEMPTS = 5;
// Rows younger than this are assumed to still be in their after() delivery.
const SWEEP_GRACE_MS = 2 * 60_000;
// Give up on anything older than this: a two-day-old reminder is noise.
const SWEEP_MAX_AGE_MS = 2 * 86_400_000;
const SIGN_IN_LINK_KINDS = ["ACCOUNT_INVITE", "PASSWORD_RESET"] as const;

/** A push written out as an email, for someone with no phone to send it to. */
function pushAsEmailBody(to: Recipient, body: string): string {
  return `Kia ora ${to.firstName},\n\n${body}\n\nNgā mihi nui,\nThe Satisfy volunteer team`;
}

/** Records a message for a volunteer, an applicant, or the coordinator when
 *  `to` is null, and schedules delivery. `ref` de-duplicates automated
 *  messages. A push draft goes to the volunteer's phones, or by email when
 *  they have not signed in to the app on one. */
export async function queueEmail(to: Recipient | ApplicantRecipient | null, draft: EmailDraft, ref?: string) {
  const e = env();
  const volunteer = to && "id" in to ? to : null;
  let channel = draft.channel ?? "EMAIL";
  let body = draft.body;
  let capture = seeding() || isDemo();
  if (channel === "PUSH") {
    if (!volunteer) {
      channel = "EMAIL";
    } else if (!seeding()) {
      const devices = await db.pushToken.count({ where: { volunteerId: volunteer.id } });
      if (devices > 0) capture = false;
      else if (!isDemo()) {
        channel = "EMAIL";
        body = pushAsEmailBody(volunteer, draft.body);
      }
    }
  }
  const row = await db.email.create({
    data: {
      volunteerId: volunteer?.id ?? null,
      applicationId: to && "applicationId" in to ? to.applicationId : null,
      channel,
      toName: to ? fullName(to) : "Volunteer coordinator",
      toEmail: to?.email ?? e.COORDINATOR_EMAIL,
      kind: draft.kind,
      subject: draft.subject,
      preview: draft.preview,
      body,
      ctaLabel: draft.ctaLabel ?? null,
      ctaHref: draft.ctaHref ?? null,
      ref: ref ?? null,
      status: capture ? "CAPTURED" : "PENDING",
    },
  });
  if (!capture) scheduleDelivery(row.id);
  return row;
}

/** Sends a sign-in link (invite or password reset) straight away. The link is
 *  never stored: the logged row has no call to action, so a failed send can
 *  only be fixed by sending a new link. Returns whether it was handed over. */
export async function sendSignInLinkEmail(to: Recipient, draft: EmailDraft, url: string): Promise<boolean> {
  const capture = isDemo() || seeding();
  const row = await db.email.create({
    data: {
      volunteerId: to.id,
      toName: fullName(to),
      toEmail: to.email,
      kind: draft.kind,
      subject: draft.subject,
      preview: draft.preview,
      body: draft.body,
      ctaLabel: draft.ctaLabel ?? null,
      ctaHref: null,
      status: capture ? "CAPTURED" : "PENDING",
      attempts: capture ? 0 : 1,
    },
  });
  if (capture) {
    // Demo deployments never email, but a developer trying the flow needs the link.
    if (env().NODE_ENV !== "production") console.log(`\n[email] sign-in link for ${to.email}: ${url}\n`);
    return true;
  }
  try {
    const providerId = await sendEmail({ ...toOutgoing(row), ctaHref: url });
    await db.email.update({ where: { id: row.id }, data: { status: "SENT", sentAt: new Date(), providerId } });
    return true;
  } catch (err) {
    console.error("[email] sign-in link send failed", err);
    await db.email.update({ where: { id: row.id }, data: { status: "FAILED", lastError: errorText(err) } });
    return false;
  }
}

function scheduleDelivery(id: string) {
  try {
    after(() => deliverEmail(id));
  } catch {
    // Outside a request (scripts, tests): deliver now. deliverEmail never
    // rejects, so nothing is left unhandled.
    void deliverEmail(id);
  }
}

/** Who a logged message is for, which picks its footer. */
export function emailAudience(row: Pick<Email, "volunteerId" | "applicationId">) {
  return row.volunteerId ? ("volunteer" as const) : row.applicationId ? ("applicant" as const) : ("coordinator" as const);
}

function toOutgoing(row: Email) {
  return {
    to: row.toEmail,
    toName: row.toName,
    subject: row.subject,
    preview: row.preview,
    body: row.body,
    ctaLabel: row.ctaLabel,
    ctaHref: row.ctaHref,
    audience: emailAudience(row),
    idempotencyKey: `email-${row.id}`,
  };
}

function errorText(err: unknown): string {
  return (err instanceof Error ? err.message : String(err)).slice(0, 500);
}

/** Delivers one PENDING or FAILED message and reports whether it went out.
 *  Never throws: anything that goes wrong is logged and left for the sweep. */
export async function deliverEmail(id: string): Promise<boolean> {
  try {
    return await attemptDelivery(id);
  } catch (err) {
    console.error(`[email] could not process ${id}`, err);
    return false;
  }
}

// The attempt counter doubles as an optimistic lock, so a sweep and an
// after() callback cannot both send the same message.
async function attemptDelivery(id: string): Promise<boolean> {
  const row = await db.email.findUnique({ where: { id } });
  if (!row || (row.status !== "PENDING" && row.status !== "FAILED") || row.attempts >= MAX_ATTEMPTS) return false;
  if ((SIGN_IN_LINK_KINDS as readonly string[]).includes(row.kind)) return false;
  const claimed = await db.email.updateMany({
    where: { id, attempts: row.attempts, status: row.status },
    data: { attempts: { increment: 1 } },
  });
  if (claimed.count === 0) return false;
  try {
    const sent = row.channel === "PUSH" ? await deliverPush(row) : { providerId: await sendEmail(toOutgoing(row)) };
    await db.email.update({ where: { id }, data: { status: "SENT", sentAt: new Date(), providerId: sent.providerId, lastError: null } });
    return true;
  } catch (err) {
    console.error(`[email] delivery failed for ${id}`, err);
    await db.email.update({ where: { id }, data: { status: "FAILED", lastError: errorText(err) } });
    return false;
  }
}

/** Sends a push to every phone the volunteer is signed in on. When they have
 *  none left (signed out, or uninstalled the app since it was queued), the
 *  row becomes an email with the same words, outside the demo. */
async function deliverPush(row: Email): Promise<{ providerId: string | null }> {
  if (!row.volunteerId) throw new Error("A push needs a volunteer");
  const result = await pushToVolunteer(row.volunteerId, {
    title: row.subject,
    body: row.preview,
    data: { url: row.ctaHref ?? undefined, kind: row.kind },
  });
  if (result.delivered > 0) return { providerId: result.ticketIds.join(",") || null };
  if (result.devices > 0) throw new Error("Expo did not accept the notification for any device");
  if (isDemo()) throw new Error("No phone is signed in to the app");
  const volunteer = await db.volunteer.findUniqueOrThrow({ where: { id: row.volunteerId } });
  const asEmail = await db.email.update({ where: { id: row.id }, data: { channel: "EMAIL", body: pushAsEmailBody(volunteer, row.body) } });
  return { providerId: await sendEmail(toOutgoing(asEmail)) };
}

/** Retries anything that has not gone out. Run by the hourly job. */
export async function sweepOutbox(now = new Date()) {
  const due = await db.email.findMany({
    where: {
      status: { in: ["PENDING", "FAILED"] },
      attempts: { lt: MAX_ATTEMPTS },
      kind: { notIn: [...SIGN_IN_LINK_KINDS] },
      createdAt: { lt: new Date(now.getTime() - SWEEP_GRACE_MS), gt: new Date(now.getTime() - SWEEP_MAX_AGE_MS) },
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  let sent = 0;
  for (const { id } of due) if (await deliverEmail(id)) sent++;
  return { retried: due.length, sent };
}
