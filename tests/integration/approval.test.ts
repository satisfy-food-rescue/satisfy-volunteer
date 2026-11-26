import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import type { VolunteerRole } from "@/lib/domain";
import * as mailer from "@/lib/mailer";
import { approveSignUp } from "@/lib/applications";
import { makeVolunteer, resetDb } from "./helpers";

function apply(email: string, interests: VolunteerRole[] = ["WAREHOUSE"]) {
  return db.application.create({
    data: { firstName: "Aroha", lastName: "Ngata", email, interests, availability: "Mornings", source: "WEBSITE" },
  });
}

describe("approving a sign-up", () => {
  beforeEach(async () => {
    await resetDb();
    vi.spyOn(mailer, "sendEmail").mockResolvedValue("re");
  });
  afterEach(() => vi.restoreAllMocks());

  it("creates a volunteer account and sends an invite", async () => {
    const coordinator = await makeVolunteer({ role: "ADMIN" });
    const app = await apply("aroha@example.org");

    expect(await approveSignUp(coordinator, app.id)).toMatchObject({ ok: true });
    const volunteer = await db.volunteer.findUniqueOrThrow({ where: { email: "aroha@example.org" } });
    expect(volunteer).toMatchObject({ role: "VOLUNTEER", status: "ACTIVE", roles: ["TRAINING"] });
    expect(await db.authToken.count({ where: { volunteerId: volunteer.id, purpose: "INVITE" } })).toBe(1);
    expect(await db.rolePeriod.findMany({ where: { volunteerId: volunteer.id } })).toMatchObject([{ role: "TRAINING", endedOn: null }]);
  });

  it("puts harvest-only volunteers straight in the harvest pool, skipping training", async () => {
    const coordinator = await makeVolunteer({ role: "ADMIN" });
    const app = await apply("emma@example.org", ["HARVEST"]);

    await approveSignUp(coordinator, app.id);
    const volunteer = await db.volunteer.findUniqueOrThrow({ where: { email: "emma@example.org" } });
    expect(volunteer.roles).toEqual(["HARVEST"]);
  });

  it("brings a deactivated coordinator back as a volunteer, without coordinator access", async () => {
    const coordinator = await makeVolunteer({ role: "ADMIN" });
    const former = await makeVolunteer({ role: "ADMIN", email: "former@example.org" });
    await db.volunteer.update({ where: { id: former.id }, data: { status: "INACTIVE" } });
    const app = await apply("former@example.org");

    const r = await approveSignUp(coordinator, app.id);
    expect(r).toMatchObject({ ok: true });
    expect(r.ok && r.message).toContain("as a volunteer");
    expect(await db.volunteer.findUniqueOrThrow({ where: { id: former.id } })).toMatchObject({ role: "VOLUNTEER", status: "ACTIVE" });
    const log = await db.contactLog.findFirstOrThrow({ where: { volunteerId: former.id } });
    expect(log.summary).toContain("without coordinator access");
  });

  it("refuses an application already reviewed", async () => {
    const coordinator = await makeVolunteer({ role: "ADMIN" });
    const app = await apply("aroha@example.org");
    await approveSignUp(coordinator, app.id);

    expect(await approveSignUp(coordinator, app.id)).toEqual({ ok: false, error: "Application already reviewed." });
  });
});
