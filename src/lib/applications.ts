import "server-only";
// Signing up to volunteer, shared by the website's /sign-up action and the
// native app's POST /api/mobile/apply so both follow the same rules. Signing
// up never creates an account: it sends an application to the coordinator,
// and approving it (approveSignUp, from Admin > Applications) does.
import { z } from "zod";
import type { SignUpField, SignUpInput } from "@satisfy/core/api";
import type { Volunteer } from "@/generated/prisma/client";
import { db } from "./db";
import { todayISO } from "./dates";
import { INITIAL_VISIT_CODE, ROLE_LABEL, VOLUNTEER_ROLES, fullName, normaliseEmail, sortRoles, type ApplicationSource } from "./domain";
import { sendSignInLink } from "./auth";
import type { ActionResult } from "./volunteer-actions";
import { queueEmail } from "./emails";
import * as T from "./email-templates";
import { LIMITS, take } from "./rate-limit";
import { ORG } from "./brand";

const phone = (missing: string) =>
  z
    .string(missing)
    .trim()
    .min(1, missing)
    .max(30, "That phone number is too long.")
    .refine((v) => /^[\d\s()+-]+$/.test(v) && v.replace(/\D/g, "").length >= 7, "Enter a phone number with at least 7 digits.");

const required = (missing: string, max: number) => z.string(missing).trim().min(1, missing).max(max, `Keep this under ${max} characters.`);

export const signUpSchema = z.object({
  firstName: required("Enter your first name.", 60),
  lastName: required("Enter your last name.", 60),
  email: z.string("Enter your email address.").trim().min(1, "Enter your email address.").pipe(z.email("Enter a valid email address.")),
  phone: phone("Enter a phone number we can call you on."),
  suburb: required("Enter your suburb or town.", 60),
  birthYear: z
    .number("Enter the year you were born, like 1985.")
    .int("Enter the year you were born, like 1985.")
    .min(1900, "Enter the year you were born, like 1985.")
    .refine((y) => y <= Number(todayISO().slice(0, 4)), "Enter the year you were born, like 1985.")
    .nullable()
    .default(null),
  interests: z.array(z.enum(VOLUNTEER_ROLES, "Choose from the ways to help listed."), "Choose at least one way you would like to help.").min(1, "Choose at least one way you would like to help."),
  availability: required("Tell us when you are usually free.", 300),
  emergencyName: required("Enter your emergency contact's name.", 80),
  emergencyPhone: phone("Enter your emergency contact's phone number."),
  message: z.string("Keep your message under 1000 characters.").trim().max(1000, "Keep your message under 1000 characters.").default(""),
  privacy: z.literal(true, "Please confirm you have read the privacy policy."),
}) satisfies z.ZodType<SignUpInput>;

const FIELDS = Object.keys(signUpSchema.shape) as SignUpField[];
const isField = (k: unknown): k is SignUpField => typeof k === "string" && (FIELDS as string[]).includes(k);

/** A message for each field that needs fixing, in form order. */
export type SignUpErrors = Partial<Record<SignUpField, string>>;

export type SignUpResult =
  | { ok: true; message: string }
  /** `fields` is set when the form needs fixing; `error` is then its first message. */
  | { ok: false; status: 400 | 429; error: string; fields?: SignUpErrors };

/** Checks and records a sign-up from `ip`. The reply does not say whether the
 *  address already has an account: an active volunteer or coordinator is
 *  emailed to sign in instead, and a second sign-up while one is waiting
 *  updates it. Callers revalidate /admin on success. */
export async function submitSignUp(raw: unknown, source: ApplicationSource, ip: string): Promise<SignUpResult> {
  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) {
    const found: SignUpErrors = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (isField(key)) found[key] ??= issue.message;
    }
    const fields: SignUpErrors = Object.fromEntries(FIELDS.filter((f) => found[f]).map((f) => [f, found[f]]));
    const first = Object.values(fields)[0];
    return first ? { ok: false, status: 400, error: first, fields } : { ok: false, status: 400, error: "Please check the form." };
  }
  const d = parsed.data;
  const email = normaliseEmail(d.email);
  if (!take(`apply:email:${email}`, LIMITS.applyPerEmail) || !take(`apply:ip:${ip}`, LIMITS.applyPerIp)) {
    return { ok: false, status: 429, error: `We have had a few sign-ups from you already. Please try again in an hour, or email ${ORG.coordinatorEmail}.` };
  }
  const message = `Thanks, ${d.firstName}. We have your application and will be in touch soon.`;

  const existing = await db.volunteer.findUnique({ where: { email } });
  if (existing?.status === "ACTIVE") {
    await queueEmail(existing, T.alreadyRegistered({ firstName: existing.firstName }));
    return { ok: true, message };
  }

  const details = {
    firstName: d.firstName,
    lastName: d.lastName,
    phone: d.phone,
    suburb: d.suburb,
    birthYear: d.birthYear,
    interests: sortRoles(d.interests),
    availability: d.availability,
    emergencyName: d.emergencyName,
    emergencyPhone: d.emergencyPhone,
    message: d.message || null,
  };
  // Someone correcting their details: keep their place in the queue and do
  // not tell the coordinator twice.
  const waiting = await db.application.findFirst({ where: { email, status: "PENDING" }, orderBy: { submittedAt: "desc" } });
  if (waiting) {
    await db.application.update({ where: { id: waiting.id }, data: details });
    return { ok: true, message };
  }

  const application = await db.application.create({ data: { ...details, email, source } });
  await queueEmail({ applicationId: application.id, firstName: d.firstName, lastName: d.lastName, email }, T.applicationReceived({ firstName: d.firstName }), `application-received:${application.id}`);
  await queueEmail(
    null,
    T.applicationNew({
      applicationId: application.id,
      name: `${d.firstName} ${d.lastName}`,
      source: source === "APP" ? "app" : "website",
      suburb: d.suburb,
      interests: details.interests.map((r) => ROLE_LABEL[r]),
      availability: d.availability,
      message: details.message,
    }),
    `application-new:${application.id}`,
  );
  return { ok: true, message };
}

type Actor = Pick<Volunteer, "id" | "firstName">;

/** Approves a pending application: a new account, or a returning volunteer's
 *  old one reactivated with its history and training. Someone who signs up
 *  comes back as a volunteer, never as a coordinator: a former coordinator's
 *  access is only given back from Admin > Coordinators. Emails them a link to
 *  set a password. */
export async function approveSignUp(actor: Actor, id: string): Promise<ActionResult> {
  const app = await db.application.findUnique({ where: { id } });
  if (!app || app.status !== "PENDING") return { ok: false, error: "Application already reviewed." };
  const email = normaliseEmail(app.email);
  const existing = await db.volunteer.findUnique({ where: { email } });
  if (existing?.status === "ACTIVE") return { ok: false, error: `${fullName(existing)} already has an active account with this email. Decline this application and update their profile instead.` };
  const induction = await db.trainingSession.findFirst({ where: { startsAt: { gte: new Date() }, module: { code: INITIAL_VISIT_CODE } }, include: { rsvps: { where: { status: "GOING" } } }, orderBy: { startsAt: "asc" } });
  // Undefined leaves a returning volunteer's existing value alone.
  const details = {
    firstName: app.firstName, lastName: app.lastName, phone: app.phone ?? undefined, suburb: app.suburb ?? undefined, birthYear: app.birthYear ?? undefined,
    roles: app.interests.length ? sortRoles(app.interests) : ["WAREHOUSE" as const], availabilityNote: app.availability,
    emergencyName: app.emergencyName ?? undefined, emergencyPhone: app.emergencyPhone ?? undefined,
  };
  const wasCoordinator = existing?.role === "ADMIN";
  // Someone coming back keeps their account, history and training records.
  const volunteer = existing
    ? await db.volunteer.update({ where: { id: existing.id }, data: { ...details, status: "ACTIVE", role: "VOLUNTEER" } })
    : await db.volunteer.create({ data: { ...details, email, joinedAt: new Date() } });
  const visit = induction && (induction.rsvps.length < induction.capacity || induction.rsvps.some((r) => r.volunteerId === volunteer.id)) ? induction : null;
  if (visit) {
    await db.sessionRsvp.upsert({ where: { sessionId_volunteerId: { sessionId: visit.id, volunteerId: volunteer.id } }, create: { sessionId: visit.id, volunteerId: volunteer.id, status: "GOING" }, update: { status: "GOING" } });
  }
  await db.application.update({ where: { id }, data: { status: "APPROVED", reviewedAt: new Date(), volunteerId: volunteer.id } });
  // What they were sent as an applicant joins their communication history.
  await db.email.updateMany({ where: { applicationId: id, volunteerId: null }, data: { volunteerId: volunteer.id } });
  await db.contactLog.create({
    data: existing
      ? { volunteerId: volunteer.id, authorId: actor.id, kind: "STATUS_CHANGED", summary: `Signed up again. Application approved and account reactivated${wasCoordinator ? " as a volunteer, without coordinator access" : ""}.` }
      : { volunteerId: volunteer.id, authorId: actor.id, kind: "ACCOUNT_CREATED", summary: "Application approved." },
  });
  await queueEmail(volunteer, T.applicationApproved({ firstName: volunteer.firstName, inductionAt: visit?.startsAt, inductionLocation: visit?.location }));
  const invited = await sendSignInLink(volunteer, volunteer.passwordHash || volunteer.lastSignInAt ? "PASSWORD_RESET" : "INVITE");
  return { ok: true, message: `${app.firstName} approved. ${existing ? `Their old account is active again${wasCoordinator ? ", as a volunteer" : ""}` : "Account created"}${visit ? " and pencilled into the next initial visit" : ""}.${invited ? "" : " The sign-in invite could not be sent; resend it from their profile."}` };
}
