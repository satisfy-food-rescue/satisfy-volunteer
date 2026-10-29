import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { assertDemoDatabase, seedDemo } from "@/lib/demo/seed";
import { makeVolunteer, resetDb } from "./helpers";

// The demo seed wipes every table, so it must only ever run against a
// database holding nothing but demo data, whatever DEMO_MODE says.
describe("the demo seed's database check", () => {
  beforeEach(resetDb);

  it("allows an empty database", async () => {
    await expect(assertDemoDatabase()).resolves.toBeUndefined();
  });

  it("allows a database the demo seed wrote", async () => {
    await makeVolunteer();
    await db.meta.create({ data: { key: "demoSeededOn", value: "2026-10-01" } });
    await expect(assertDemoDatabase()).resolves.toBeUndefined();
  });

  it("refuses a database with real volunteers, and the seed leaves them alone", async () => {
    const real = await makeVolunteer();
    await expect(assertDemoDatabase()).rejects.toThrow(/Refusing to replace this database/);
    await expect(seedDemo()).rejects.toThrow(/Refusing to replace this database/);
    expect(await db.volunteer.findUnique({ where: { id: real.id } })).not.toBeNull();
  });

  it("refuses a database holding only applications", async () => {
    await db.application.create({ data: { firstName: "Aroha", lastName: "Ngata", email: "aroha@example.org", interests: ["WAREHOUSE"], availability: "Mornings", source: "WEBSITE" } });
    await expect(assertDemoDatabase()).rejects.toThrow(/Refusing to replace this database/);
  });
});
