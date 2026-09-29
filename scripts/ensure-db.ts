// Runs before `next dev`. Creates the SQLite database on first run and reseeds
// whenever the demo date has rolled over, so seed dates stay relative to today,
// or the seed script has changed, so a deploy never serves stale demo data.
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { todayISO } from "../src/lib/dates";

const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const file = url.replace(/^file:/, "");

function run(cmd: string) {
  execSync(cmd, { stdio: "inherit" });
}

async function main() {
  const fresh = !existsSync(file);
  if (fresh) {
    console.log("No database yet. Creating schema...");
    run("pnpm exec prisma db push");
  }
  const seedHash = createHash("sha256").update(readFileSync("prisma/seed.ts")).digest("hex");
  let db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
  let seededOn: string | null = null;
  let seededHash: string | null = null;
  try {
    seededOn = (await db.meta.findUnique({ where: { key: "seededOn" } }))?.value ?? null;
    seededHash = (await db.meta.findUnique({ where: { key: "seedHash" } }))?.value ?? null;
  } catch {
    // Schema out of date; push again.
    await db.$disconnect();
    run("pnpm exec prisma db push");
  } finally {
    await db.$disconnect();
  }
  const today = todayISO();
  const reason =
    process.env.RESEED === "1" ? "RESEED=1"
    : seededOn !== today ? `seed is from ${seededOn ?? "never"}`
    : seededHash !== seedHash ? "seed script changed"
    : null;
  if (reason) {
    console.log(fresh ? "Seeding demo data..." : `Reseeding for ${today} (${reason})...`);
    run("pnpm exec tsx prisma/seed.ts");
    db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
    await db.meta.upsert({ where: { key: "seedHash" }, update: { value: seedHash }, create: { key: "seedHash", value: seedHash } });
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
