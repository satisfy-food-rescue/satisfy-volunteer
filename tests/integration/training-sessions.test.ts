import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import * as mailer from "@/lib/mailer";
import { isoToDate, todayISO } from "@/lib/dates";
import { rsvpSession } from "@/lib/volunteer-actions";
import { makeVolunteer, resetDb } from "./helpers";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

async function sessionFor(code: string, roles: ("WAREHOUSE" | "HARVEST")[]) {
  const mod = await db.trainingModule.create({ data: { code, name: `${code} Sorting`, description: "", requiredRoles: roles, delivery: "IN_PERSON" } });
  const startsAt = new Date(Date.now() + 3 * 86_400_000);
  const session = await db.trainingSession.create({ data: { moduleId: mod.id, startsAt, endsAt: new Date(startsAt.getTime() + 3_600_000), location: "Rangiora", capacity: 10 } });
  return { mod, session };
}

describe("booking a training session", () => {
  beforeEach(async () => {
    await resetDb();
    vi.spyOn(mailer, "sendEmail").mockResolvedValue("re");
  });
  afterEach(() => vi.restoreAllMocks());

  it("is refused for a stage outside the volunteer's roles, such as T1 for a harvester", async () => {
    const emma = await makeVolunteer({ firstName: "Emma", roles: ["HARVEST"] });
    const { session } = await sessionFor("T1", ["WAREHOUSE"]);
    expect(await rsvpSession(emma, session.id, true)).toEqual({ ok: false, error: "T1 Sorting is not part of the training for your roles." });
    expect(await db.sessionRsvp.count()).toBe(0);
  });

  it("is refused for a stage already completed, while one booked earlier can still be let go", async () => {
    const margaret = await makeVolunteer({ firstName: "Margaret", roles: ["WAREHOUSE"] });
    const { mod, session } = await sessionFor("T1", ["WAREHOUSE"]);
    expect(await rsvpSession(margaret, session.id, true)).toMatchObject({ ok: true });
    await db.trainingRecord.create({ data: { volunteerId: margaret.id, moduleId: mod.id, completedAt: isoToDate(todayISO()), method: "COORDINATOR" } });

    const later = await db.trainingSession.create({ data: { moduleId: mod.id, startsAt: session.startsAt, endsAt: session.endsAt, location: "Rangiora", capacity: 10 } });
    expect(await rsvpSession(margaret, later.id, true)).toEqual({ ok: false, error: "You have already completed T1 Sorting." });
    expect(await rsvpSession(margaret, session.id, false)).toMatchObject({ ok: true });
  });
});
