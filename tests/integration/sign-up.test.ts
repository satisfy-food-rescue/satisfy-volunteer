import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SignUpInput } from "@satisfy/core/api";
import { db } from "@/lib/db";
import * as mailer from "@/lib/mailer";
import { submitSignUp } from "@/lib/applications";
import { makeVolunteer, resetDb } from "./helpers";

let n = 0;
/** A valid sign-up from a fresh address, so the rate limits never trip. */
function form(over: Partial<SignUpInput> = {}): SignUpInput {
  n++;
  return {
    firstName: "Aroha",
    lastName: "Ngata",
    email: `Aroha.Ngata${n}@Example.NZ`,
    phone: "021 555 0101",
    suburb: "Kaiapoi",
    birthYear: 1969,
    interests: ["HARVEST", "WAREHOUSE"],
    availability: "Monday and Wednesday mornings",
    emergencyName: "Hemi Ngata",
    emergencyPhone: "027 555 0102",
    message: "Keen to help.",
    privacy: true,
    ...over,
  };
}
const ip = () => `10.0.0.${n}`;

describe("signing up", () => {
  beforeEach(resetDb);
  afterEach(() => vi.restoreAllMocks());

  it("records an application and emails the applicant and the coordinator", async () => {
    const send = vi.spyOn(mailer, "sendEmail").mockResolvedValue("re");
    const input = form();
    const r = await submitSignUp(input, "APP", ip());
    expect(r).toEqual({ ok: true, message: "Thanks, Aroha. We have your application and will be in touch soon." });

    const app = await db.application.findFirstOrThrow();
    expect(app).toMatchObject({
      email: input.email.toLowerCase(),
      source: "APP",
      status: "PENDING",
      interests: ["WAREHOUSE", "HARVEST"],
      emergencyName: "Hemi Ngata",
      message: "Keen to help.",
    });
    expect(await db.volunteer.count()).toBe(0);

    const emails = await db.email.findMany({ orderBy: { kind: "asc" } });
    expect(emails.map((e) => [e.kind, e.toEmail, e.applicationId, e.ref])).toEqual([
      ["APPLICATION_RECEIVED", app.email, app.id, `application-received:${app.id}`],
      ["APPLICATION_NEW", "coordinator@example.org", null, `application-new:${app.id}`],
    ]);
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(2));
    const audiences = send.mock.calls.map((c) => [c[0].to, c[0].audience]);
    expect(audiences).toContainEqual([app.email, "applicant"]);
    expect(audiences).toContainEqual(["coordinator@example.org", "coordinator"]);
  });

  it("emails an existing volunteer to sign in instead, with the same reply", async () => {
    const send = vi.spyOn(mailer, "sendEmail").mockResolvedValue("re");
    const v = await makeVolunteer({ firstName: "Margaret", email: "margaret@example.org" });
    const r = await submitSignUp(form({ email: "Margaret@Example.org" }), "WEBSITE", ip());
    expect(r.ok).toBe(true);
    expect(await db.application.count()).toBe(0);
    const emails = await db.email.findMany();
    expect(emails).toHaveLength(1);
    expect(emails[0]).toMatchObject({ kind: "ALREADY_REGISTERED", volunteerId: v.id, ctaHref: "/sign-in" });
    await vi.waitFor(() => expect(send).toHaveBeenCalledOnce());
  });

  it("treats a former volunteer as a new application", async () => {
    vi.spyOn(mailer, "sendEmail").mockResolvedValue("re");
    const v = await makeVolunteer({ email: "back@example.org" });
    await db.volunteer.update({ where: { id: v.id }, data: { status: "INACTIVE" } });
    expect((await submitSignUp(form({ email: "back@example.org" }), "WEBSITE", ip())).ok).toBe(true);
    expect(await db.application.count({ where: { email: "back@example.org", status: "PENDING" } })).toBe(1);
  });

  it("updates a waiting application instead of adding another, without telling anyone twice", async () => {
    vi.spyOn(mailer, "sendEmail").mockResolvedValue("re");
    const first = form();
    await submitSignUp(first, "WEBSITE", ip());
    const before = await db.application.findFirstOrThrow();
    await submitSignUp({ ...first, availability: "Fridays", interests: ["VOLUNTEER_DRIVER"] }, "APP", `${ip()}1`);

    const apps = await db.application.findMany();
    expect(apps).toHaveLength(1);
    expect(apps[0]).toMatchObject({ id: before.id, availability: "Fridays", interests: ["VOLUNTEER_DRIVER"], submittedAt: before.submittedAt, source: "WEBSITE" });
    expect(await db.email.count()).toBe(2);
  });

  it("names every field that needs fixing, in form order", async () => {
    const r = await submitSignUp({ ...form(), firstName: " ", email: "nope", phone: "12", interests: [], privacy: false, birthYear: 1850 }, "WEBSITE", ip());
    expect(r).toEqual({
      ok: false,
      status: 400,
      error: "Enter your first name.",
      fields: {
        firstName: "Enter your first name.",
        email: "Enter a valid email address.",
        phone: "Enter a phone number with at least 7 digits.",
        birthYear: "Enter the year you were born, like 1985.",
        interests: "Choose at least one way you would like to help.",
        privacy: "Please confirm you have read the privacy policy.",
      },
    });
    expect(await db.application.count()).toBe(0);
  });

  it("answers a missing or malformed body in words, not types", async () => {
    const r = await submitSignUp({ firstName: "Tama" }, "APP", ip());
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.fields?.email).toBe("Enter your email address.");
    expect(r.fields?.interests).toBe("Choose at least one way you would like to help.");
    expect(r.fields).not.toHaveProperty("birthYear");
    expect(r.fields).not.toHaveProperty("message");
    expect((await submitSignUp(null, "APP", ip())).ok).toBe(false);
  });

  it("limits sign-ups from one address", async () => {
    vi.spyOn(mailer, "sendEmail").mockResolvedValue("re");
    const from = "10.9.9.9";
    const results = [];
    for (let i = 0; i < 11; i++) results.push(await submitSignUp(form(), "WEBSITE", from));
    expect(results.slice(0, 10).every((r) => r.ok)).toBe(true);
    expect(results[10]).toMatchObject({ ok: false, status: 429 });
  });
});
