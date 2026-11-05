import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { isoToDate, todayISO } from "@/lib/dates";
import { loadHarvest } from "@/lib/harvest";
import { makeVolunteer, resetDb } from "./helpers";

describe("harvest training", () => {
  beforeEach(resetDb);

  it("leaves out modules still in development, so they do not hold anyone back", async () => {
    const today = todayISO();
    const emma = await makeVolunteer({ firstName: "Emma", roles: ["HARVEST"] });
    const picking = await db.trainingModule.create({ data: { code: "HP", name: "Harvest picking", description: "", requiredRoles: ["HARVEST"], delivery: "ONLINE_CONFIRM", content: "Pick gently." } });
    await db.trainingModule.create({ data: { code: "HL", name: "Ladders", description: "", requiredRoles: ["HARVEST"], delivery: "ONLINE_CONFIRM", content: "", inDevelopment: true } });
    expect(await loadHarvest(emma, today)).toMatchObject({ trained: false, harvestTraining: [{ module: { code: "HP" } }] });

    await db.trainingRecord.create({ data: { volunteerId: emma.id, moduleId: picking.id, completedAt: isoToDate(today), method: "ONLINE" } });
    expect(await loadHarvest(emma, today)).toMatchObject({ trained: true, harvestTraining: [{ module: { code: "HP" }, status: "COMPLETE" }] });
  });
});
