import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import * as mailer from "@/lib/mailer";
import { addDays, dateToISO, isoToDate, todayISO } from "@/lib/dates";
import { changeRoles, openRolePeriods } from "@/lib/roles";
import { setHarvestPool, startTraining } from "@/lib/volunteer-actions";
import { volunteerReport } from "@/lib/volunteer-report";
import { makeVolunteer, resetDb } from "./helpers";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

describe("role history", () => {
  beforeEach(async () => {
    await resetDb();
    vi.spyOn(mailer, "sendEmail").mockResolvedValue("re");
  });
  afterEach(() => vi.restoreAllMocks());

  it("closes the roles removed and opens the ones added, dated today", async () => {
    const today = todayISO();
    const v = await makeVolunteer({ roles: ["TRAINING"] });
    await db.$transaction((tx) => openRolePeriods(tx, v.id, ["TRAINING"], addDays(today, -30)));

    expect(await changeRoles(v.id, ["TRAINING"], ["WAREHOUSE"])).toMatchObject({ added: ["WAREHOUSE"], removed: ["TRAINING"] });
    const periods = await db.rolePeriod.findMany({ where: { volunteerId: v.id }, orderBy: { role: "asc" } });
    expect(periods.map((p) => ({ role: p.role, started: dateToISO(p.startedOn), ended: p.endedOn && dateToISO(p.endedOn) }))).toEqual([
      { role: "TRAINING", started: addDays(today, -30), ended: today },
      { role: "WAREHOUSE", started: today, ended: null },
    ]);
    expect((await db.volunteer.findUniqueOrThrow({ where: { id: v.id } })).roles).toEqual(["WAREHOUSE"]);
  });

  it("follows the harvest pool as volunteers join and leave it", async () => {
    const v = await makeVolunteer({ roles: ["WAREHOUSE"] });
    await setHarvestPool(v, true);
    await setHarvestPool(await db.volunteer.findUniqueOrThrow({ where: { id: v.id } }), false);
    const harvest = await db.rolePeriod.findMany({ where: { volunteerId: v.id, role: "HARVEST" } });
    expect(harvest).toHaveLength(1);
    expect(harvest[0]!.endedOn).not.toBeNull();
  });

  it("lets a harvest-only volunteer start training themselves, and tells the coordinator", async () => {
    const t1 = await db.trainingModule.create({ data: { code: "T1", name: "T1 in-person training", description: "", requiredRoles: ["TRAINING", "WAREHOUSE"], delivery: "IN_PERSON" } });
    const emma = await makeVolunteer({ firstName: "Emma", roles: ["HARVEST"] });

    expect(await startTraining(emma)).toMatchObject({ ok: true });
    expect((await db.volunteer.findUniqueOrThrow({ where: { id: emma.id } })).roles).toEqual(["TRAINING", "HARVEST"]);
    expect(await db.rolePeriod.count({ where: { volunteerId: emma.id, role: "TRAINING", endedOn: null } })).toBe(1);
    const email = await db.email.findFirstOrThrow({ where: { volunteerId: null, kind: "ROLES_CHANGED" } });
    expect(email.subject).toBe("Emma Test would like to become a regular volunteer");
    expect(email.body).toContain(t1.name);

    const regular = await makeVolunteer({ roles: ["WAREHOUSE", "HARVEST"] });
    expect(await startTraining(regular)).toMatchObject({ ok: false });
  });

  it("reports role start dates, MOJ checks and stages marked not applicable", async () => {
    const today = todayISO();
    const t1 = await db.trainingModule.create({ data: { code: "T1", name: "T1 in-person training", description: "", requiredRoles: ["TRAINING", "WAREHOUSE"], delivery: "IN_PERSON" } });
    const v = await makeVolunteer({ firstName: "Grace", roles: ["WAREHOUSE"] });
    await db.$transaction((tx) => openRolePeriods(tx, v.id, ["WAREHOUSE"], "2024-03-01"));
    await db.mojCheck.create({ data: { volunteerId: v.id, checkedOn: isoToDate("2025-06-01") } });
    await db.trainingRecord.create({ data: { volunteerId: v.id, moduleId: t1.id, completedAt: isoToDate(today), method: "NOT_APPLICABLE" } });
    await makeVolunteer({ firstName: "Harvey", roles: ["HARVEST"] });

    const csv = await volunteerReport({ status: "active", role: "WAREHOUSE" }, today);
    const [header, row, ...rest] = csv.replace(/^﻿/, "").trim().split("\r\n");
    expect(rest).toHaveLength(0);
    const cells = Object.fromEntries(header!.split(",").map((h, i) => [h, row!.split(",")[i]]));
    expect(cells).toMatchObject({ Name: "Grace Test", "Warehouse sorting since": "2024-03-01", "In training since": "", "MOJ check dated": "2025-06-01", "MOJ check renews": "2028-06-01", "T1 in-person training": "Not applicable" });
  });
});
