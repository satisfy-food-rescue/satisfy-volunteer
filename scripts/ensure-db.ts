// Runs before `next dev`. Creates the SQLite database on first run and reseeds
// whenever the demo date has rolled over, so seed dates stay relative to today.
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
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
  const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
  let seededOn: string | null = null;
  try {
    seededOn = (await db.meta.findUnique({ where: { key: "seededOn" } }))?.value ?? null;
  } catch {
    // Schema out of date; push again.
    await db.$disconnect();
    run("pnpm exec prisma db push");
  } finally {
    await db.$disconnect();
  }
  const today = todayISO();
  if (seededOn !== today || process.env.RESEED === "1") {
    console.log(fresh ? "Seeding demo data..." : `Seed is from ${seededOn ?? "never"}; reseeding for ${today}...`);
    run("pnpm exec tsx prisma/seed.ts");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
