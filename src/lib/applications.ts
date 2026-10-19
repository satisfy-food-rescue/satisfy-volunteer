import "server-only";
// Signing up to volunteer, shared by the website's /sign-up action and the
// native app's POST /api/mobile/apply so both follow the same rules. Signing
// up never creates an account: it sends an application to the coordinator,
// and approving it (approveApplication in src/app/admin/actions.ts) does.
import { z } from "zod";
import type { SignUpField, SignUpInput } from "@satisfy/core/api";
import { db } from "./db";
import { todayISO } from "./dates";
import { ROLE_LABEL, VOLUNTEER_ROLES, normaliseEmail, sortRoles, type ApplicationSource } from "./domain";
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
