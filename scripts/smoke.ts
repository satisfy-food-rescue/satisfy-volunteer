// Renders every page against a running server as every persona and fails on
// anything but a 200. Pages are discovered from src/app, so a new page is
// covered without touching this file; a new dynamic segment needs a resolver
// below. Run after `pnpm build && pnpm start:prod`:
//   BASE_URL=http://localhost:3000 pnpm test:smoke
import { globSync } from "node:fs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { addDays, isoToDate, todayISO } from "../src/lib/dates";
import { PERSONA_COOKIE } from "../src/lib/session";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });

type Check = { path: string; persona: string | null; cookie?: string; expect: number; location?: string };

// Values to try for each dynamic route. Shifts are limited to a fortnight
// around today, which covers past, current, cancelled and upcoming shifts.
async function resolvers(): Promise<Record<string, string[]>> {
  const today = todayISO();
  const shifts = await db.shift.findMany({
    where: { date: { gte: isoToDate(addDays(today, -7)), lte: isoToDate(addDays(today, 7)) } },
    select: { id: true },
  });
  const ids = (rows: { id: string }[]) => rows.map((r) => r.id);
  return {
    "/app/shifts/[id]": ids(shifts),
    "/app/training/[code]": (await db.trainingModule.findMany({ select: { code: true } })).map((m) => m.code),
    "/admin/roster/[id]": ids(shifts),
    "/admin/volunteers/[id]": ids(await db.volunteer.findMany({ select: { id: true } })),
    "/admin/outbox/[id]": ids(await db.email.findMany({ select: { id: true } })),
    "/admin/training/sessions/[id]": ids(await db.trainingSession.findMany({ select: { id: true } })),
  };
}

function routes() {
  return globSync("src/app/**/page.tsx")
    .map((f) => "/" + f.replace(/^src\/app\/?/, "").replace(/\/?page\.tsx$/, ""))
    .map((r) => r.split("/").filter((s) => !/^\(.*\)$/.test(s)).join("/") || "/")
    .sort();
}

async function main() {
  const values = await resolvers();
  const personas = await db.volunteer.findMany({ where: { personaKey: { not: null } } });
  const admins = personas.filter((p) => p.role === "ADMIN");
  const volunteers = personas.filter((p) => p.role !== "ADMIN");
  if (!admins.length || !volunteers.length) throw new Error("Seed has no admin or volunteer persona");

  const checks: Check[] = [
    { path: "/", persona: null, expect: 307, location: "/sign-in" },
    { path: "/sign-in", persona: null, expect: 200 },
    { path: "/app", persona: null, expect: 307, location: "/sign-in" },
    { path: "/admin", persona: null, expect: 307, location: "/sign-in" },
    { path: "/admin", persona: volunteers[0].personaKey, cookie: volunteers[0].id, expect: 307, location: "/app" },
  ];
  for (const route of routes()) {
    const area = route.startsWith("/admin") ? admins : route.startsWith("/app") ? volunteers : null;
    if (!area) continue;
    let paths = [route];
    if (route.includes("[")) {
      const vs = values[route];
      if (!vs) throw new Error(`No smoke-test values for ${route}. Add a resolver in scripts/smoke.ts.`);
      if (!vs.length) throw new Error(`The seed has no rows for ${route}`);
      paths = vs.map((v) => route.replace(/\[[^\]]+\]/, encodeURIComponent(v)));
    }
    for (const p of area) for (const path of paths) checks.push({ path, persona: p.personaKey, cookie: p.id, expect: 200 });
  }

  const failures: string[] = [];
  const queue = [...checks];
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      for (let c = queue.shift(); c; c = queue.shift()) {
        const res = await fetch(base + c.path, {
          redirect: "manual",
          headers: c.cookie ? { cookie: `${PERSONA_COOKIE}=${c.cookie}` } : {},
        });
        const location = res.headers.get("location");
        const who = c.persona ?? "signed out";
        if (res.status !== c.expect) failures.push(`${c.path} as ${who}: expected ${c.expect}, got ${res.status}`);
        else if (c.location && location && new URL(location, base).pathname !== c.location)
          failures.push(`${c.path} as ${who}: redirected to ${location}, expected ${c.location}`);
        await res.arrayBuffer();
      }
    }),
  );

  if (failures.length) {
    console.error(`${failures.length} of ${checks.length} smoke checks failed:\n  ${failures.join("\n  ")}`);
    process.exitCode = 1;
  } else {
    console.log(`All ${checks.length} smoke checks passed against ${base}.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
