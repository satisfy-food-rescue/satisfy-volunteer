// Renders every page against a running server as every persona and fails on
// anything but a 200. Pages are discovered from src/app, so a new page is
// covered without touching this file; a new dynamic segment needs a resolver
// below. Then signs in to the native app API as every volunteer persona and
// reads every endpoint. Run after `pnpm build && pnpm start:prod`:
//   BASE_URL=http://localhost:3000 pnpm test:smoke
import { globSync } from "node:fs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import type { Volunteer } from "../src/generated/prisma/client";
import type * as Api from "@satisfy/core/api";
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

  const apiChecks = await mobileApiChecks(admins, volunteers, values, failures);
  const total = checks.length + apiChecks;

  if (failures.length) {
    console.error(`${failures.length} of ${total} smoke checks failed:\n  ${failures.join("\n  ")}`);
    process.exitCode = 1;
  } else {
    console.log(`All ${total} smoke checks passed against ${base} (${checks.length} pages, ${apiChecks} native app API calls).`);
  }
}

// Native app API ---------------------------------------------------------------

const isStr = (v: unknown): v is string => typeof v === "string";
const isNum = (v: unknown): v is number => typeof v === "number";
const isArr = Array.isArray;
const ACTIONS = ["PAST", "MINE", "BLOCKED", "FULL", "BOOK"];
const shiftOk = (s: Api.ShiftSummary) => isStr(s.id) && isStr(s.iso) && isStr(s.name) && isArr(s.crew) && ACTIONS.includes(s.action?.kind);

/** Every read endpoint as every volunteer persona, plus the auth edges.
 *  Returns how many calls were made; problems go into `failures`. */
async function mobileApiChecks(admins: Volunteer[], volunteers: Volunteer[], values: Record<string, string[]>, failures: string[]) {
  let calls = 0;
  async function call<T>(who: string, method: string, path: string, opts: { token?: string; body?: unknown; expect?: number; check?: (body: T) => boolean } = {}) {
    calls++;
    const res = await fetch(`${base}/api/mobile${path}`, {
      method,
      headers: { ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}), ...(opts.body ? { "content-type": "application/json" } : {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const expect = opts.expect ?? 200;
    const body = (await res.json().catch(() => null)) as T | null;
    const label = `API ${method} ${path} as ${who}`;
    if (res.status !== expect) failures.push(`${label}: expected ${expect}, got ${res.status} ${JSON.stringify(body)}`);
    else if (expect >= 400 && !isStr((body as Api.ApiFailure | null)?.error)) failures.push(`${label}: no { error } in the ${expect} response`);
    else if (body === null || (opts.check && !opts.check(body))) failures.push(`${label}: unexpected shape ${JSON.stringify(body).slice(0, 300)}`);
    return body;
  }

  await call("signed out", "GET", "/session", { expect: 401 });
  await call("signed out", "GET", "/session", { token: "not-a-real-token", expect: 401 });
  await call("signed out", "GET", "/no-such-endpoint", { expect: 404 });
  await call<Api.DemoPersonas>("signed out", "GET", "/auth/personas", {
    check: (b) => volunteers.every((v) => b.personas.some((p) => p.key === v.personaKey)) && !b.personas.some((p) => admins.some((a) => a.personaKey === p.key)),
  });
  for (const a of admins) await call(a.personaKey!, "POST", "/auth/demo", { body: { personaKey: a.personaKey }, expect: 403 });

  const shiftIds = values["/app/shifts/[id]"];
  const moduleCodes = values["/app/training/[code]"];
  await Promise.all(
    volunteers.map(async (v) => {
      const who = v.personaKey!;
      const signIn = await call<Api.SignInResult>(who, "POST", "/auth/demo", { body: { personaKey: who }, check: (b) => isStr(b.token) && b.session.me.id === v.id });
      const token = signIn?.token;
      if (!token) return;
      const today = todayISO();
      const get = <T>(path: string, check: (b: T) => boolean) => call<T>(who, "GET", path, { token, check });
      await get<Api.MobileSession>("/session", (b) => b.me.id === v.id && b.today === today && isNum(b.badges.cover) && isNum(b.badges.training));
      await get<Api.Home>("/home", (b) => b.today === today && isStr(b.empty.cta) && isNum(b.impact.meals) && (b.next === null || shiftOk(b.next)));
      for (const week of ["", `?week=${addDays(today, 7)}`]) {
        await get<Api.ShiftsWeek>(`/shifts${week}`, (b) => b.days.length === 5 && b.days.every((d) => isArr(d.shifts) && d.shifts.every(shiftOk)));
      }
      for (const id of shiftIds) await get<Api.ShiftDetail>(`/shifts/${id}`, (b) => b.id === id && shiftOk(b) && isArr(b.stops));
      await get<Api.CoverList>("/cover", (b) => b.shifts.every((s) => shiftOk(s) && s.isGap));
      await get<Api.TrainingOverview>("/training", (b) => b.required.length > 0 && isNum(b.summary.current) && isArr(b.sessions));
      for (const code of moduleCodes) await get<Api.TrainingModuleDetail>(`/training/modules/${code}`, (b) => b.module.code === code && isArr(b.paragraphs));
      await get<Api.SlotOverview>("/slot", (b) => isArr(b.slots) && isArr(b.absences) && isArr(b.upcoming));
      await get<Api.HarvestOverview>("/harvest", (b) => isArr(b.callouts) && isNum(b.poolCount));
      const profile: Api.ProfileInput = { phone: v.phone ?? "", suburb: v.suburb ?? "", emergencyName: v.emergencyName ?? "", emergencyPhone: v.emergencyPhone ?? "", availabilityNote: v.availabilityNote ?? "", lastMinuteOk: v.lastMinuteOk };
      await call<Api.MutationOk>(who, "PATCH", "/profile", { token, body: profile, check: (b) => isStr(b.message) });
      await call<Api.MutationOk>(who, "DELETE", "/auth/session", { token, body: {}, check: (b) => isStr(b.message) });
      await call(who, "GET", "/session", { token, expect: 401 });
    }),
  );
  return calls;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
