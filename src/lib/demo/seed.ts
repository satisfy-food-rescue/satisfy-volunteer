// Demo data. Everything is relative to today (NZ) so the demo never looks
// stale, and a deterministic PRNG makes a reseed on the same day identical.
// Wipes every table first, so it refuses to run against production data.
import type { AssignmentSource, AssignmentStatus, ContactLogKind, TrainingMethod } from "@/generated/prisma/client";
import { db } from "../db";
import {
  addDays,
  addMonths,
  dateToISO,
  daysBetween,
  isoToDate,
  isWeekday,
  nzInstant,
  todayISO,
  weekdayOf,
  weekMonday,
} from "../dates";
import { ABSENCE_REASON_LABEL, INITIAL_VISIT_CODE, type AbsenceReason, type VolunteerRole } from "../domain";
import * as T from "../email-templates";
import { runCoverChecks } from "../cover";
import { withCapturedEmails } from "../emails";
import { env, isDemo } from "../env";
import { hashPassword } from "../passwords";
import { DEMO_PASSWORD, PERSONAS, personaEmail } from "../personas";
import { createReferenceData } from "../reference-data";

// ---------------------------------------------------------------------------
// Deterministic randomness
// ---------------------------------------------------------------------------
const PRNG_SEED = 20261234;
let seedState = PRNG_SEED;
function rand(): number {
  seedState |= 0;
  seedState = (seedState + 0x6d2b79f5) | 0;
  let t = Math.imul(seedState ^ (seedState >>> 15), 1 | seedState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const randInt = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];

let TODAY = "";
const WEEKS_BACK = 26;
const WEEKS_FORWARD = 8;

function emailFor(first: string, last: string) {
  return `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, "") + "@example.nz";
}
function phone() {
  return `02${randInt(1, 9)} ${randInt(100, 999)} ${randInt(1000, 9999)}`;
}
const SUBURBS = [
  "Rangiora", "Rangiora", "Rangiora", "Kaiapoi", "Kaiapoi", "Woodend", "Pegasus",
  "Oxford", "Amberley", "Belfast", "Redwood", "Northwood", "Ohoka", "Swannanoa",
  "Fernside", "Waikuku Beach", "Cust", "Loburn",
];

// ---------------------------------------------------------------------------
// Volunteers
// ---------------------------------------------------------------------------
type VolSpec = {
  key?: string;
  first: string;
  last: string | null;
  born: number;
  roles: VolunteerRole[];
  slots?: { template: string; weekday: number }[];
  lastMinute?: boolean;
  admin?: boolean;
  joinedYearsAgo?: number;
  notes?: string;
  availability?: string;
};

const W = "warehouse-am";
const DA_RK = "da-rangiora-kaiapoi";
const DA_CN = "da-chch-north";
const DA_HU = "da-hurunui";
const VD_HU = "vd-hurunui";
const HV = "harvest";

const VOLUNTEERS: VolSpec[] = [
  { key: "phillipa", first: "Phillipa", last: null, born: 1978, roles: ["WAREHOUSE"], admin: true, joinedYearsAgo: 3 },
  // Monday warehouse
  { first: "Brian", last: "Tweedie", born: 1954, roles: ["WAREHOUSE"], slots: [{ template: W, weekday: 1 }], joinedYearsAgo: 6 },
  { first: "Judith", last: "Alcock", born: 1958, roles: ["WAREHOUSE"], slots: [{ template: W, weekday: 1 }, { template: W, weekday: 3 }], joinedYearsAgo: 4 },
  { first: "Rangi", last: "Parata", born: 1961, roles: ["WAREHOUSE"], slots: [{ template: W, weekday: 1 }, { template: W, weekday: 4 }], joinedYearsAgo: 2 },
  { first: "Sue", last: "Hollander", born: 1956, roles: ["WAREHOUSE"], slots: [{ template: W, weekday: 1 }], joinedYearsAgo: 7 },
  { first: "Peter", last: "Mackintosh", born: 1950, roles: ["WAREHOUSE"], slots: [{ template: W, weekday: 1 }], joinedYearsAgo: 9, notes: "Prefers the weighing station. Bad knee, avoid heavy lifting." },
  { first: "Lesley", last: "Cunningham", lastMinute: true, born: 1963, roles: ["WAREHOUSE"], slots: [{ template: W, weekday: 1 }, { template: W, weekday: 5 }], joinedYearsAgo: 1 },
  // Tuesday warehouse
  { key: "margaret", first: "Margaret", last: "Fairweather", born: 1958, roles: ["WAREHOUSE"], slots: [{ template: W, weekday: 2 }, { template: W, weekday: 4 }], joinedYearsAgo: 5, notes: "Great with new volunteers. Happy to buddy inductees." },
  { first: "Graham", last: "Lister", born: 1952, roles: ["WAREHOUSE"], slots: [{ template: W, weekday: 2 }], joinedYearsAgo: 8 },
  { first: "Hine", last: "Tauwhare", born: 1966, roles: ["WAREHOUSE"], slots: [{ template: W, weekday: 2 }], joinedYearsAgo: 2 },
  { first: "Wendy", last: "Bruce", born: 1959, roles: ["WAREHOUSE"], slots: [{ template: W, weekday: 2 }], joinedYearsAgo: 3 },
  { first: "Alan", last: "Prebble", born: 1955, roles: ["WAREHOUSE"], slots: [{ template: W, weekday: 2 }], joinedYearsAgo: 6 },
  { first: "Carol", last: "Dunlop", born: 1957, roles: ["WAREHOUSE"], slots: [{ template: W, weekday: 2 }], joinedYearsAgo: 4 },
  // Wednesday warehouse
  { first: "Colin", last: "Baxter", born: 1951, roles: ["WAREHOUSE"], slots: [{ template: W, weekday: 3 }], joinedYearsAgo: 9 },
  { first: "Kathy", last: "Moriarty", born: 1960, roles: ["WAREHOUSE"], slots: [{ template: W, weekday: 3 }], joinedYearsAgo: 2 },
  { first: "Te Aroha", last: "Waaka", lastMinute: true, born: 1975, roles: ["WAREHOUSE", "HARVEST"], slots: [{ template: W, weekday: 3 }], joinedYearsAgo: 1 },
  { first: "Dennis", last: "Ford", born: 1953, roles: ["WAREHOUSE"], slots: [{ template: W, weekday: 3 }], joinedYearsAgo: 5 },
  { first: "Pauline", last: "Hewitt", born: 1956, roles: ["WAREHOUSE"], slots: [{ template: W, weekday: 3 }], joinedYearsAgo: 7 },
  // Thursday warehouse
  { first: "Barbara", last: "Kemp", born: 1954, roles: ["WAREHOUSE"], slots: [{ template: W, weekday: 4 }], joinedYearsAgo: 6 },
  { first: "Mike", last: "Sutherland", born: 1949, roles: ["WAREHOUSE"], slots: [{ template: W, weekday: 4 }], joinedYearsAgo: 10 },
  { first: "Anne", last: "Whitfield", born: 1962, roles: ["WAREHOUSE"], slots: [{ template: W, weekday: 4 }], joinedYearsAgo: 3 },
  { first: "Sione", last: "Tuilagi", lastMinute: true, born: 1980, roles: ["WAREHOUSE", "HARVEST"], slots: [{ template: W, weekday: 4 }], joinedYearsAgo: 1 },
  // Friday warehouse
  { first: "Ngaire", last: "Puketapu", born: 1957, roles: ["WAREHOUSE"], slots: [{ template: W, weekday: 5 }], joinedYearsAgo: 4 },
  { first: "Frank", last: "Doyle", born: 1948, roles: ["WAREHOUSE"], slots: [{ template: W, weekday: 5 }], joinedYearsAgo: 9 },
  { first: "Robyn", last: "Ashworth", born: 1959, roles: ["WAREHOUSE"], slots: [{ template: W, weekday: 5 }], joinedYearsAgo: 2 },
  { first: "Kevin", last: "Marshall", born: 1955, roles: ["WAREHOUSE"], slots: [{ template: W, weekday: 5 }], joinedYearsAgo: 5 },
  { first: "Liz", last: "Stratford", born: 1968, roles: ["WAREHOUSE"], slots: [{ template: W, weekday: 5 }], joinedYearsAgo: 1 },
  // Driver help, Rangiora / Kaiapoi route
  { first: "Trevor", last: "Hansen", born: 1952, roles: ["WAREHOUSE", "DRIVERS_ASSISTANT"], slots: [{ template: DA_RK, weekday: 1 }], joinedYearsAgo: 7 },
  { first: "Moana", last: "Rikihana", lastMinute: true, born: 1970, roles: ["WAREHOUSE", "DRIVERS_ASSISTANT"], slots: [{ template: DA_RK, weekday: 2 }], joinedYearsAgo: 2 },
  { key: "tony", first: "Tony", last: "Ratana", born: 1963, roles: ["WAREHOUSE", "DRIVERS_ASSISTANT"], slots: [{ template: DA_RK, weekday: 3 }], joinedYearsAgo: 3, notes: "Knows the Kaiapoi stores well. Sometimes covers Fridays." },
  { first: "Ian", last: "Carmichael", born: 1954, roles: ["WAREHOUSE", "DRIVERS_ASSISTANT"], slots: [{ template: DA_RK, weekday: 4 }], joinedYearsAgo: 5 },
  { first: "Debbie", last: "Ryan", born: 1965, roles: ["WAREHOUSE", "DRIVERS_ASSISTANT"], slots: [{ template: DA_RK, weekday: 5 }], joinedYearsAgo: 4 },
  // Driver help, Christchurch North route
  { first: "Gary", last: "Pemberton", born: 1950, roles: ["WAREHOUSE", "DRIVERS_ASSISTANT"], slots: [{ template: DA_CN, weekday: 1 }], joinedYearsAgo: 8 },
  { first: "Heather", last: "Lowe", born: 1958, roles: ["WAREHOUSE", "DRIVERS_ASSISTANT"], slots: [{ template: DA_CN, weekday: 2 }], joinedYearsAgo: 6 },
  { first: "Wiremu", last: "Kahui", born: 1972, roles: ["WAREHOUSE", "DRIVERS_ASSISTANT"], slots: [{ template: DA_CN, weekday: 3 }], joinedYearsAgo: 2 },
  { first: "Rachel", last: "Simmons", lastMinute: true, born: 1983, roles: ["WAREHOUSE", "DRIVERS_ASSISTANT"], slots: [{ template: DA_CN, weekday: 4 }], joinedYearsAgo: 1 },
  { first: "Norm", last: "Blackwell", born: 1947, roles: ["WAREHOUSE", "DRIVERS_ASSISTANT"], slots: [{ template: DA_CN, weekday: 5 }], joinedYearsAgo: 9 },
  // Hurunui route: fully volunteer-driven, Tuesday and Thursday
  { first: "Doug", last: "Fleming", born: 1953, roles: ["WAREHOUSE", "DRIVERS_ASSISTANT", "VOLUNTEER_DRIVER"], slots: [{ template: VD_HU, weekday: 2 }], joinedYearsAgo: 6 },
  { first: "Jan", last: "Ravenscroft", born: 1956, roles: ["WAREHOUSE", "DRIVERS_ASSISTANT", "VOLUNTEER_DRIVER"], slots: [{ template: VD_HU, weekday: 4 }], joinedYearsAgo: 4 },
  { first: "Steve", last: "Kirkwood", lastMinute: true, born: 1958, roles: ["WAREHOUSE", "DRIVERS_ASSISTANT", "VOLUNTEER_DRIVER"], joinedYearsAgo: 3, availability: "Flexible most weekday mornings. Happy to be called last-minute.", notes: "Backup driver for the Hurunui route." },
  { first: "Pat", last: "Whyte", born: 1951, roles: ["WAREHOUSE", "DRIVERS_ASSISTANT"], slots: [{ template: DA_HU, weekday: 2 }], joinedYearsAgo: 5 },
  { first: "Mere", last: "Tainui", born: 1960, roles: ["WAREHOUSE", "DRIVERS_ASSISTANT"], slots: [{ template: DA_HU, weekday: 4 }], joinedYearsAgo: 3 },
  // Harvest pool only
  { first: "Emma", last: "Whitcombe", born: 1992, roles: ["HARVEST"], joinedYearsAgo: 1, availability: "Weekends and school holidays for harvests." },
  { first: "Josh", last: "Tairoa", born: 1988, roles: ["HARVEST"], joinedYearsAgo: 2, availability: "Saturdays." },
  { first: "Fiona", last: "Grant", lastMinute: true, born: 1971, roles: ["WAREHOUSE", "HARVEST"], joinedYearsAgo: 4 },
  { first: "Ravi", last: "Naidoo", lastMinute: true, born: 1979, roles: ["WAREHOUSE", "HARVEST"], joinedYearsAgo: 1 },
  // Brand-new volunteer, signed up on the website and approved two days ago, no training yet
  { key: "jess", first: "Jess", last: "Moorhouse", born: 2001, roles: ["WAREHOUSE"], joinedYearsAgo: 0, availability: "Tuesday and Thursday mornings during uni term." },
];

// ---------------------------------------------------------------------------
/** Replaces everything in the database with fresh demo data for today. Only
 *  wipes a database that holds nothing but demo data: one this seed wrote, or
 *  one with no people in it yet. DEMO_MODE alone is not enough, since a demo
 *  deployment given production's DATABASE_URL by mistake has it set. */
export async function seedDemo() {
  if (env().NODE_ENV === "production" && !isDemo()) {
    throw new Error("Refusing to wipe a production database: the demo seed only runs with DEMO_MODE=1.");
  }
  await assertDemoDatabase();
  TODAY = todayISO();
  seedState = PRNG_SEED;
  console.log(`Seeding Satisfy demo relative to ${TODAY}`);

  // Phones and browsers signed in as a persona keep their session and push
  // token across the daily reseed. Volunteer ids change, so they are
  // re-linked by email.
  const kept = await db.volunteer.findMany({
    where: { email: { in: PERSONAS.map((p) => p.email) } },
    select: { email: true, sessions: true, pushTokens: true },
  });

  // Wipe in dependency order.
  await db.email.deleteMany();
  await db.contactLog.deleteMany();
  await db.announcement.deleteMany();
  await db.sessionRsvp.deleteMany();
  await db.trainingRecord.deleteMany();
  await db.trainingSession.deleteMany();
  await db.trainingModule.deleteMany();
  await db.assignment.deleteMany();
  await db.absence.deleteMany();
  await db.regularSlot.deleteMany();
  await db.shift.deleteMany();
  await db.shiftTemplate.deleteMany();
  await db.donor.deleteMany();
  await db.route.deleteMany();
  await db.recipient.deleteMany();
  await db.application.deleteMany();
  await db.volunteer.deleteMany();
  await db.meta.deleteMany();

  const ref = await createReferenceData(db);
  const templateRows = await db.shiftTemplate.findMany();
  const templates = new Map<string, { id: string; kind: string; name: string; start: string; end: string; capacity: number; needed: number; weekdays: number[] }>();
  for (const [key, id] of ref.templateIds) {
    const t = templateRows.find((r) => r.id === id)!;
    templates.set(key, { id, kind: t.kind, name: t.name, start: t.startTime, end: t.endTime, capacity: t.capacity, needed: t.needed, weekdays: t.weekdays });
  }
  const moduleRows = await db.trainingModule.findMany();
  const modules = new Map<string, { id: string; name: string; validityMonths: number | null; requiredRoles: VolunteerRole[]; delivery: string }>();
  for (const [code, id] of ref.moduleIds) {
    const m = moduleRows.find((r) => r.id === id)!;
    modules.set(code, { id, name: m.name, validityMonths: m.validityMonths, requiredRoles: m.requiredRoles, delivery: m.delivery });
  }

  // Volunteers ---------------------------------------------------------------
  const vols = new Map<string, { id: string; first: string; last: string | null; email: string; roles: VolunteerRole[]; spec: VolSpec }>();
  const syncedAt = nzInstant(TODAY, "06:00");
  let infoodleSeq = 1041;
  const personaPassword = await hashPassword(DEMO_PASSWORD);
  for (const v of VOLUNTEERS) {
    const email = (v.key && personaEmail(v.key)) || emailFor(v.first, v.last ?? "volunteer");
    const yearsAgo = v.joinedYearsAgo ?? 2;
    const joined = v.key === "jess" ? isoToDate(addDays(TODAY, -2)) : isoToDate(addDays(TODAY, -(yearsAgo * 365 + randInt(0, 200))));
    const row = await db.volunteer.create({
      data: {
        firstName: v.first,
        lastName: v.last,
        email,
        phone: phone(),
        suburb: pick(SUBURBS),
        birthYear: v.born,
        role: v.admin ? "ADMIN" : "VOLUNTEER",
        passwordHash: v.key ? personaPassword : null,
        emailVerifiedAt: v.key ? joined : null,
        lastSignInAt: v.key && v.key !== "jess" ? nzInstant(addDays(TODAY, -randInt(1, 6)), "08:30") : null,
        roles: v.roles,
        isRegular: (v.slots?.length ?? 0) > 0,
        lastMinuteOk: v.lastMinute ?? false,
        emergencyName: v.admin ? null : pick(["Partner", "Daughter", "Son", "Neighbour", "Sister", "Brother"]) + " - " + pick(["Chris", "Sam", "Jo", "Alex", "Pat", "Kim", "Nikau", "Mel"]),
        emergencyPhone: v.admin ? null : phone(),
        availabilityNote: v.availability ?? (v.slots?.length ? "Regular weekly slot. Can occasionally cover other mornings with notice." : null),
        notes: v.notes ?? null,
        joinedAt: joined,
        infoodleId: `IF-${infoodleSeq++}`,
        infoodleSyncedAt: syncedAt,
      },
    });
    vols.set(v.key ?? `${v.first}-${v.last}`, { id: row.id, first: v.first, last: v.last, email, roles: v.roles, spec: v });
  }
  const byName = (first: string, last: string) => vols.get(`${first}-${last}`)!;
  const phillipa = vols.get("phillipa")!;
  const margaret = vols.get("margaret")!;
  const tony = vols.get("tony")!;
  const jess = vols.get("jess")!;

  // Regular slots ------------------------------------------------------------
  const slotIndex = new Map<string, string[]>(); // `${templateId}:${weekday}` -> volunteerIds
  for (const v of vols.values()) {
    for (const s of v.spec.slots ?? []) {
      const t = templates.get(s.template)!;
      await db.regularSlot.create({ data: { volunteerId: v.id, templateId: t.id, weekday: s.weekday } });
      const k = `${t.id}:${s.weekday}`;
      slotIndex.set(k, [...(slotIndex.get(k) ?? []), v.id]);
    }
  }

  // Shifts -------------------------------------------------------------------
  const rangeStart = addDays(weekMonday(TODAY), -7 * WEEKS_BACK);
  const rangeEnd = addDays(weekMonday(TODAY), 7 * WEEKS_FORWARD + 4);
  const shiftRows: { templateId: string; date: Date; startTime: string; endTime: string; capacity: number; needed: number }[] = [];
  for (let d = rangeStart; d <= rangeEnd; d = addDays(d, 1)) {
    if (!isWeekday(d)) continue;
    const wd = weekdayOf(d);
    for (const t of templates.values()) {
      if (!t.weekdays.includes(wd)) continue;
      shiftRows.push({ templateId: t.id, date: isoToDate(d), startTime: t.start, endTime: t.end, capacity: t.capacity, needed: t.needed });
    }
  }
  await db.shift.createMany({ data: shiftRows });
  const shifts = await db.shift.findMany({ orderBy: { date: "asc" } });
  const shiftsByDate = new Map<string, typeof shifts>();
  for (const s of shifts) {
    const iso = dateToISO(s.date);
    shiftsByDate.set(iso, [...(shiftsByDate.get(iso) ?? []), s]);
  }

  // Assignments from regular slots ------------------------------------------
  const assignmentRows: { shiftId: string; volunteerId: string; source: AssignmentSource; status: AssignmentStatus; absenceId?: string | null; createdAt?: Date }[] = [];
  for (const s of shifts) {
    const iso = dateToISO(s.date);
    const wd = weekdayOf(iso);
    const regulars = slotIndex.get(`${s.templateId}:${wd}`) ?? [];
    const past = iso < TODAY;
    for (const volunteerId of regulars) {
      // Skip Jess-style newcomers (none have slots) and skip volunteers before their join date.
      let status: AssignmentStatus = "CONFIRMED";
      if (past) status = rand() < 0.035 ? "NO_SHOW" : "ATTENDED";
      assignmentRows.push({ shiftId: s.id, volunteerId, source: "REGULAR", status, createdAt: isoToDate(addDays(iso, -28)) });
    }
    // Occasional extra one-off booking on past warehouse shifts.
    if (past && s.templateId === templates.get(W)!.id && rand() < 0.35) {
      const extra = pick([byName("Steve", "Kirkwood"), byName("Emma", "Whitcombe"), byName("Josh", "Tairoa"), byName("Fiona", "Grant"), byName("Ravi", "Naidoo"), byName("Rachel", "Simmons")]);
      if (!regulars.includes(extra.id)) {
        assignmentRows.push({ shiftId: s.id, volunteerId: extra.id, source: "BOOKED", status: rand() < 0.05 ? "NO_SHOW" : "ATTENDED", createdAt: isoToDate(addDays(iso, -randInt(2, 10))) });
      }
    }
  }
  await db.assignment.createMany({ data: assignmentRows });

  // Absences -----------------------------------------------------------------
  async function createAbsence(vol: { id: string }, startISO: string, endISO: string, reason: AbsenceReason, note: string | null, opts: { coverBy?: { id: string }; createdDaysBefore?: number } = {}) {
    const absence = await db.absence.create({
      data: { volunteerId: vol.id, startDate: isoToDate(startISO), endDate: isoToDate(endISO), reason, note, createdAt: isoToDate(addDays(startISO, -(opts.createdDaysBefore ?? randInt(3, 21)))) },
    });
    const affected = await db.assignment.findMany({
      where: { volunteerId: vol.id, shift: { date: { gte: isoToDate(startISO), lte: isoToDate(endISO) } } },
      include: { shift: true },
    });
    for (const a of affected) {
      await db.assignment.update({ where: { id: a.id }, data: { status: "RELEASED", absenceId: absence.id } });
      if (opts.coverBy) {
        const iso = dateToISO(a.shift.date);
        await db.assignment.create({
          data: { shiftId: a.shiftId, volunteerId: opts.coverBy.id, source: "COVER", status: iso < TODAY ? "ATTENDED" : "CONFIRMED", createdAt: isoToDate(addDays(iso, -randInt(1, 5))) },
        });
      }
    }
    return absence;
  }

  // Two upcoming absences that leave visible uncovered gaps.
  await createAbsence(byName("Brian", "Tweedie"), addDays(TODAY, 3), addDays(TODAY, 12), "HOLIDAY", "Fishing trip to the Sounds", { createdDaysBefore: 9 });
  await createAbsence(byName("Heather", "Lowe"), TODAY, addDays(TODAY, 6), "SICK", "Chest infection, doctor says a week off", { createdDaysBefore: 0 });
  // An upcoming absence already covered, so the calendar shows both states.
  const ngaireFriday = (() => { let d = addDays(TODAY, 7); while (weekdayOf(d) !== 5) d = addDays(d, 1); return d; })();
  await createAbsence(byName("Ngaire", "Puketapu"), addDays(ngaireFriday, -1), ngaireFriday, "OTHER", "Grandchild's school production", { coverBy: byName("Fiona", "Grant") });
  // A few past absences, mostly covered.
  await createAbsence(byName("Colin", "Baxter"), addDays(TODAY, -24), addDays(TODAY, -17), "HOLIDAY", "Gold Coast", { coverBy: byName("Steve", "Kirkwood") });
  await createAbsence(byName("Wendy", "Bruce"), addDays(TODAY, -45), addDays(TODAY, -44), "SICK", null, { coverBy: byName("Josh", "Tairoa") });
  await createAbsence(byName("Gary", "Pemberton"), addDays(TODAY, -70), addDays(TODAY, -60), "HOLIDAY", "Visiting family in Nelson", { coverBy: byName("Steve", "Kirkwood") });
  await createAbsence(byName("Anne", "Whitfield"), addDays(TODAY, -100), addDays(TODAY, -94), "OTHER", "Jury service");
  await createAbsence(byName("Kevin", "Marshall"), addDays(TODAY, -130), addDays(TODAY, -117), "HOLIDAY", "Rarotonga", { coverBy: byName("Ravi", "Naidoo") });

  // Training sessions --------------------------------------------------------
  const nextWeekday = (from: string) => { let d = from; while (!isWeekday(d)) d = addDays(d, 1); return d; };

  // A short-notice cancellation on the next working day's route, inside the
  // route's last-minute window, so pushes and the coordinator alert show up.
  const lateISO = nextWeekday(addDays(TODAY, 1));
  const lateHolder = [DA_RK, DA_CN]
    .map((key) => (slotIndex.get(`${templates.get(key)!.id}:${weekdayOf(lateISO)}`) ?? [])[0])
    .map((id) => [...vols.values()].find((v) => v.id === id))
    .find((v) => v && v.id !== tony.id)!;
  await createAbsence(lateHolder, lateISO, lateISO, "SICK", "Rang in with a migraine", { createdDaysBefore: daysBetween(TODAY, lateISO) });
  const inductionISO = nextWeekday(addDays(TODAY, 5));
  const mhISO = nextWeekday(addDays(TODAY, 9));
  const rvsISO = nextWeekday(addDays(TODAY, 16));
  const pastSessionISO = nextWeekday(addDays(TODAY, -20));
  const warehouse = "Satisfy warehouse, Rangiora";
  // An open initial-visit slot the coordinator can offer during a welcome call.
  await db.trainingSession.create({ data: { moduleId: modules.get(INITIAL_VISIT_CODE)!.id, startsAt: nzInstant(inductionISO, "10:00"), endsAt: nzInstant(inductionISO, "11:00"), location: warehouse, capacity: 2, notes: "Includes a walk-through of the sorting floor and chiller." } });
  const sessionMH = await db.trainingSession.create({ data: { moduleId: modules.get("MANUAL_HANDLING")!.id, startsAt: nzInstant(mhISO, "12:30"), endsAt: nzInstant(mhISO, "13:15"), location: warehouse, capacity: 12, notes: "Straight after the morning sort. Hands-on refresher for anyone who prefers it to the online version." } });
  const sessionRVS = await db.trainingSession.create({ data: { moduleId: modules.get("ROUTE_VEHICLE_SAFETY")!.id, startsAt: nzInstant(rvsISO, "13:00"), endsAt: nzInstant(rvsISO, "14:30"), location: warehouse + " (loading bay)", capacity: 8, notes: "Bring your route notes. Dave will run the van loading demo." } });
  const sessionPast = await db.trainingSession.create({ data: { moduleId: modules.get("SLIPS_TRIPS_FALLS")!.id, startsAt: nzInstant(pastSessionISO, "12:30"), endsAt: nzInstant(pastSessionISO, "13:00"), location: warehouse, capacity: 12 } });

  // Training records ---------------------------------------------------------
  type Override = { daysToExpiry?: number; skip?: boolean };
  const overrides = new Map<string, Override>();
  const ov = (v: { id: string }, code: string, o: Override) => overrides.set(`${v.id}:${code}`, o);
  // Due soon
  ov(margaret, "FOOD_SAFETY", { daysToExpiry: 18 });
  ov(byName("Graham", "Lister"), "MANUAL_HANDLING", { daysToExpiry: 12 });
  ov(byName("Wendy", "Bruce"), "SLIPS_TRIPS_FALLS", { daysToExpiry: 25 });
  ov(byName("Trevor", "Hansen"), "ROUTE_VEHICLE_SAFETY", { daysToExpiry: 9 });
  ov(byName("Gary", "Pemberton"), "MANUAL_HANDLING", { daysToExpiry: 27 });
  ov(byName("Doug", "Fleming"), "DRIVER_LICENCE_CHECK", { daysToExpiry: 20 });
  ov(byName("Kathy", "Moriarty"), "FOOD_SAFETY", { daysToExpiry: 6 });
  // Overdue
  ov(tony, "MANUAL_HANDLING", { daysToExpiry: -21 });
  ov(byName("Frank", "Doyle"), "SLIPS_TRIPS_FALLS", { daysToExpiry: -40 });
  ov(byName("Norm", "Blackwell"), "ROUTE_VEHICLE_SAFETY", { daysToExpiry: -10 });
  // Not started
  ov(byName("Emma", "Whitcombe"), "SLIPS_TRIPS_FALLS", { skip: true });
  ov(byName("Ravi", "Naidoo"), "FOOD_SAFETY", { skip: true });

  const recordRows: { volunteerId: string; moduleId: string; completedAt: Date; expiresAt: Date | null; method: TrainingMethod; sessionId?: string | null }[] = [];
  for (const v of vols.values()) {
    if (v.id === jess.id) continue;
    for (const m of modules.values()) {
      if (!m.requiredRoles.some((r) => v.roles.includes(r))) continue;
      const code = [...modules.entries()].find(([, mm]) => mm.id === m.id)![0];
      const o = overrides.get(`${v.id}:${code}`);
      if (o?.skip) continue;
      let completedISO: string;
      let expiresISO: string | null;
      if (m.validityMonths === null) {
        const yearsAgo = v.spec.joinedYearsAgo ?? 2;
        completedISO = addDays(TODAY, -(Math.max(yearsAgo, 0) * 365 + randInt(1, 120)));
        expiresISO = null;
      } else if (o?.daysToExpiry !== undefined) {
        expiresISO = addDays(TODAY, o.daysToExpiry);
        completedISO = addMonths(expiresISO, -m.validityMonths);
      } else {
        completedISO = addDays(TODAY, -randInt(40, m.validityMonths * 30 - 45));
        expiresISO = addMonths(completedISO, m.validityMonths);
      }
      const method: TrainingMethod = m.delivery === "ONLINE_CONFIRM" ? (rand() < 0.8 ? "ONLINE" : "SESSION") : code === "DRIVER_LICENCE_CHECK" ? "COORDINATOR" : "SESSION";
      recordRows.push({ volunteerId: v.id, moduleId: m.id, completedAt: isoToDate(completedISO), expiresAt: expiresISO ? isoToDate(expiresISO) : null, method });
    }
  }
  await db.trainingRecord.createMany({ data: recordRows });

  // Past session attendance: a handful attended and got their record via the session.
  const pastAttendees = [byName("Hine", "Tauwhare"), byName("Liz", "Stratford"), byName("Robyn", "Ashworth"), byName("Sione", "Tuilagi")];
  for (const a of pastAttendees) {
    await db.sessionRsvp.create({ data: { sessionId: sessionPast.id, volunteerId: a.id, status: "GOING", attendedAt: nzInstant(pastSessionISO, "12:30") } });
    await db.trainingRecord.updateMany({ where: { volunteerId: a.id, moduleId: modules.get("SLIPS_TRIPS_FALLS")!.id }, data: { completedAt: isoToDate(pastSessionISO), expiresAt: isoToDate(addMonths(pastSessionISO, 12)), method: "SESSION", sessionId: sessionPast.id } });
  }
  // Upcoming RSVPs
  for (const a of [byName("Graham", "Lister"), byName("Gary", "Pemberton"), byName("Peter", "Mackintosh")]) {
    await db.sessionRsvp.create({ data: { sessionId: sessionMH.id, volunteerId: a.id, status: "GOING" } });
  }
  for (const a of [byName("Trevor", "Hansen"), byName("Norm", "Blackwell"), byName("Rachel", "Simmons")]) {
    await db.sessionRsvp.create({ data: { sessionId: sessionRVS.id, volunteerId: a.id, status: "GOING" } });
  }

  // Harvests -------------------------------------------------------------------
  // October in Canterbury is citrus season. One published with a callout and
  // three pickers, one still a draft, and one last week that happened.
  const hv = templates.get(HV)!;
  const nextSaturday = (from: string) => { let d = from; while (weekdayOf(d) !== 6) d = addDays(d, 1); return d; };
  const harvestISO = nextSaturday(addDays(TODAY, 7));
  const harvest = await db.shift.create({
    data: {
      templateId: hv.id, date: isoToDate(harvestISO), startTime: "09:00", endTime: "12:30", capacity: 8, needed: 6, status: "SCHEDULED", publishedAt: nzInstant(addDays(TODAY, -2), "12:00"),
      title: "Lemon and grapefruit picking",
      location: "Lifestyle block on Loburn Whiterock Road, 15 minutes north of Rangiora",
      notes: "Around 300 kg of lemons and grapefruit that the owners cannot use. Park on the grass by the gate. Ladders, picking bags and crates are provided; bring a hat, sunscreen, water and gloves if you have them. Everything goes to the warehouse for Monday's sort.",
    },
  });
  for (const a of [byName("Josh", "Tairoa"), byName("Te Aroha", "Waaka"), byName("Sione", "Tuilagi")]) {
    await db.assignment.create({ data: { shiftId: harvest.id, volunteerId: a.id, source: "BOOKED", status: "CONFIRMED", createdAt: nzInstant(addDays(TODAY, -2), "13:30") } });
  }
  await db.shift.create({
    data: {
      templateId: hv.id, date: isoToDate(nextWeekday(addDays(TODAY, 17))), startTime: "13:00", endTime: "15:30", capacity: 5, needed: 3, status: "DRAFT",
      title: "Rhubarb harvest",
      location: "Market garden on Tram Road, Ohoka",
      notes: "Waiting to confirm the date with the grower. Short afternoon pick; knives and crates provided.",
    },
  });
  const lastHarvestISO = addDays(TODAY, -9);
  const lastHarvest = await db.shift.create({
    data: { templateId: hv.id, date: isoToDate(lastHarvestISO), startTime: "10:00", endTime: "12:00", capacity: 6, needed: 4, status: "SCHEDULED", publishedAt: nzInstant(addDays(TODAY, -16), "09:00"), title: "Backyard lemon tree", location: "Williams Street, Kaiapoi" },
  });
  for (const a of [byName("Josh", "Tairoa"), byName("Fiona", "Grant"), byName("Ravi", "Naidoo"), byName("Te Aroha", "Waaka")]) {
    await db.assignment.create({ data: { shiftId: lastHarvest.id, volunteerId: a.id, source: "BOOKED", status: "ATTENDED", createdAt: nzInstant(addDays(TODAY, -15), "18:00") } });
  }

  // Applications -------------------------------------------------------------
  await db.application.createMany({
    data: [
      { firstName: "Aroha", lastName: "Ngata", email: "aroha.ngata@example.nz", phone: phone(), suburb: "Kaiapoi", birthYear: 1969, emergencyName: "Hemi Ngata", emergencyPhone: phone(), interests: ["WAREHOUSE", "DRIVERS_ASSISTANT"], availability: "Monday, Wednesday and Friday mornings", message: "Recently retired from the DHB and keen to do something practical for the community. I have a full licence and do not mind early starts.", source: "APP", submittedAt: nzInstant(addDays(TODAY, -1), "19:42") },
      { firstName: "Callum", lastName: "Reid", email: "callum.reid@example.nz", phone: phone(), suburb: "Rangiora", birthYear: 1996, emergencyName: "Isla Reid", emergencyPhone: phone(), interests: ["WAREHOUSE"], availability: "Tuesdays and Thursdays before 1pm", message: "Shift worker at the hospital, free most weekday mornings. Heard about you through Thrive Church.", source: "WEBSITE", submittedAt: nzInstant(addDays(TODAY, -3), "08:15") },
      { firstName: "Priya", lastName: "Sharma", email: "priya.sharma@example.nz", phone: phone(), suburb: "Pegasus", birthYear: 1985, emergencyName: "Arjun Sharma", emergencyPhone: phone(), interests: ["WAREHOUSE"], availability: "Any weekday morning while the kids are at school", message: null, source: "WEBSITE", submittedAt: nzInstant(addDays(TODAY, -6), "13:05") },
      { firstName: "Jess", lastName: "Moorhouse", email: jess.email, phone: phone(), suburb: "Rangiora", birthYear: 2001, emergencyName: "Sue Moorhouse", emergencyPhone: phone(), interests: ["WAREHOUSE"], availability: "Tuesday and Thursday mornings during uni term", message: "Studying environmental science at Lincoln, want to help reduce food waste locally.", source: "WEBSITE", submittedAt: nzInstant(addDays(TODAY, -5), "17:30"), status: "APPROVED", reviewedAt: nzInstant(addDays(TODAY, -2), "09:10"), volunteerId: jess.id },
      { firstName: "Mark", lastName: "Eldridge", email: "mark.eldridge@example.nz", phone: phone(), suburb: "Christchurch Central", birthYear: 1990, emergencyName: "Kate Eldridge", emergencyPhone: phone(), interests: ["VOLUNTEER_DRIVER"], availability: "Weekends only", message: "Only free on weekends.", source: "WEBSITE", submittedAt: nzInstant(addDays(TODAY, -12), "21:00"), status: "DECLINED", reviewedAt: nzInstant(addDays(TODAY, -10), "10:00"), reviewNote: "Weekend-only availability; we operate Monday to Friday. Suggested the harvest pool and Christchurch City Mission." },
    ],
  });

  // Outbox emails ------------------------------------------------------------
  const emails: { volunteerId: string | null; toName: string; toEmail: string; createdAt: Date; draft: T.EmailDraft; ref?: string }[] = [];
  // `ref` matches the dedupe keys in src/lib/reminders.ts, so running the
  // reminder check straight after a seed finds nothing new to send.
  const push = (v: { id: string; first: string; last: string | null; email: string } | null, createdAt: Date, draft: T.EmailDraft, ref?: string) =>
    emails.push({ volunteerId: v?.id ?? null, toName: v ? `${v.first}${v.last ? " " + v.last : ""}` : "Phillipa", toEmail: v?.email ?? phillipa.email, createdAt, draft, ref });

  const records = await db.trainingRecord.findMany({ where: { expiresAt: { not: null } }, include: { module: true, volunteer: true } });
  for (const r of records) {
    const expISO = dateToISO(r.expiresAt!);
    const days = Math.round((isoToDate(expISO).getTime() - isoToDate(TODAY).getTime()) / 86_400_000);
    const v = { id: r.volunteer.id, first: r.volunteer.firstName, last: r.volunteer.lastName, email: r.volunteer.email };
    const online = r.module.delivery === "ONLINE_CONFIRM";
    if (days > 0 && days <= 30) {
      push(v, nzInstant(addDays(expISO, -30), "07:00"), T.trainingDueSoon({ firstName: v.first, moduleName: r.module.name, expiresISO: expISO, daysLeft: 30, online }), `training-due:${r.id}`);
    } else if (days <= 0) {
      const blocks = r.module.requiredRoles.includes("WAREHOUSE") ? "new shifts" : "route shifts";
      push(v, nzInstant(addDays(expISO, -30), "07:00"), T.trainingDueSoon({ firstName: v.first, moduleName: r.module.name, expiresISO: expISO, daysLeft: 30, online }), `training-due:${r.id}`);
      for (let d = expISO; d <= TODAY; d = addDays(d, 7)) {
        push(v, nzInstant(d, "07:00"), T.trainingOverdue({ firstName: v.first, moduleName: r.module.name, expiredISO: expISO, online, blocks }), `training-overdue:${r.id}`);
      }
    }
  }
  // Tomorrow's shift reminders (sent this afternoon in the real system; shown as generated today).
  const tomorrow = nextWeekday(addDays(TODAY, 1));
  const tomorrowAssignments = await db.assignment.findMany({ where: { status: "CONFIRMED", shift: { date: isoToDate(tomorrow) } }, include: { shift: { include: { template: true } }, volunteer: true }, take: 6 });
  for (const a of tomorrowAssignments) {
    push({ id: a.volunteer.id, first: a.volunteer.firstName, last: a.volunteer.lastName, email: a.volunteer.email }, nzInstant(TODAY, "16:00"), T.shiftReminder({ firstName: a.volunteer.firstName, shiftName: a.shift.template.name, dateISO: tomorrow, start: a.shift.startTime, end: a.shift.endTime, shiftId: a.shiftId, where: a.shift.template.kind === "WAREHOUSE" ? "the Rangiora warehouse" : "the warehouse loading bay" }));
  }
  // Absence flow for Heather (sick today) and Brian.
  const heather = byName("Heather", "Lowe");
  push({ id: heather.id, first: heather.first, last: heather.last, email: heather.email }, nzInstant(TODAY, "06:48"), T.absenceConfirmed({ firstName: "Heather", startISO: TODAY, endISO: addDays(TODAY, 6), reasonLabel: ABSENCE_REASON_LABEL.SICK, releasedCount: 1 }));
  const heatherShift = (await db.assignment.findFirst({ where: { volunteerId: heather.id, status: "RELEASED" }, include: { shift: { include: { template: true } } }, orderBy: { shift: { date: "asc" } } }))!;
  push(null, nzInstant(TODAY, "06:48"), T.gapAlert({ shiftName: heatherShift.shift.template.name, dateISO: dateToISO(heatherShift.shift.date), start: heatherShift.shift.startTime, end: heatherShift.shift.endTime, cause: "Heather Lowe marked away (sick)", shiftId: heatherShift.shiftId }));
  const lateShift = (await db.assignment.findFirst({ where: { volunteerId: lateHolder.id, status: "RELEASED", shift: { date: isoToDate(lateISO) } }, include: { shift: { include: { template: true } } } }))!;
  push({ id: lateHolder.id, first: lateHolder.first, last: lateHolder.last, email: lateHolder.email }, nzInstant(TODAY, "07:05"), T.absenceConfirmed({ firstName: lateHolder.first, startISO: lateISO, endISO: lateISO, reasonLabel: ABSENCE_REASON_LABEL.SICK, releasedCount: 1 }));
  push(null, nzInstant(TODAY, "07:05"), T.gapAlert({ shiftName: lateShift.shift.template.name, dateISO: lateISO, start: lateShift.shift.startTime, end: lateShift.shift.endTime, cause: `${lateHolder.first} ${lateHolder.last} marked away (sick)`, shiftId: lateShift.shiftId }));
  const brian = byName("Brian", "Tweedie");
  push({ id: brian.id, first: brian.first, last: brian.last, email: brian.email }, nzInstant(addDays(TODAY, -6), "11:20"), T.absenceConfirmed({ firstName: "Brian", startISO: addDays(TODAY, 3), endISO: addDays(TODAY, 12), reasonLabel: ABSENCE_REASON_LABEL.HOLIDAY, releasedCount: 2 }));
  // Ngaire covered by Fiona.
  const fiona = byName("Fiona", "Grant");
  const fionaCover = (await db.assignment.findFirst({ where: { volunteerId: fiona.id, source: "COVER", status: "CONFIRMED" }, include: { shift: { include: { template: true } } } }))!;
  push({ id: fiona.id, first: fiona.first, last: fiona.last, email: fiona.email }, nzInstant(addDays(TODAY, -1), "15:12"), T.coverConfirmed({ firstName: "Fiona", shiftName: fionaCover.shift.template.name, dateISO: dateToISO(fionaCover.shift.date), start: fionaCover.shift.startTime, end: fionaCover.shift.endTime, shiftId: fionaCover.shiftId }));
  // Jess approved, and invited to set up her sign-in. She has not had her
  // welcome call yet, so no initial visit is booked.
  push({ id: jess.id, first: jess.first, last: jess.last, email: jess.email }, nzInstant(addDays(TODAY, -2), "09:10"), T.applicationApproved({ firstName: "Jess" }));
  push({ id: jess.id, first: jess.first, last: jess.last, email: jess.email }, nzInstant(addDays(TODAY, -2), "09:11"), T.accountInvite({ firstName: "Jess", expiresDays: 7 }));
  // Harvest callout to the pool, and the season announcement before it.
  const pool = [...vols.values()].filter((v) => v.roles.includes("HARVEST"));
  const season = await db.announcement.create({
    data: {
      subject: "Harvest season is starting",
      body: "The citrus is ready, so harvests start next week. When one is on you will get an email and a notification with a Sign up button; the first to sign up get the places.\n\nBefore your first harvest, please do the two short online modules in the app: Manual Handling and Slips, Trips and Falls. We will run a quick in-person induction on the day.",
      audience: "ROLES", roles: ["HARVEST"], audienceLabel: "Harvest pool", push: true, recipientCount: pool.length, authorId: phillipa.id, createdAt: nzInstant(addDays(TODAY, -5), "16:30"),
    },
  });
  for (const v of pool) {
    const to = { id: v.id, first: v.first, last: v.last, email: v.email };
    const ap = { firstName: v.first, subject: season.subject, body: season.body, from: "Phillipa" };
    push(to, nzInstant(addDays(TODAY, -5), "16:30"), T.announcement(ap), `announcement:${season.id}:${v.id}`);
    push(to, nzInstant(addDays(TODAY, -5), "16:30"), T.announcementPush(ap), `announcement:${season.id}:${v.id}`);
    const cp = { firstName: v.first, kindLabel: "Harvest", harvest: true, name: harvest.title!, dateISO: harvestISO, start: harvest.startTime, end: harvest.endTime, location: harvest.location!, notes: harvest.notes, spotsLeft: 8, shiftId: harvest.id };
    push(to, nzInstant(addDays(TODAY, -2), "12:00"), T.shiftCallout(cp), `callout:${harvest.id}:${v.id}`);
    push(to, nzInstant(addDays(TODAY, -2), "12:00"), T.shiftCalloutPush(cp), `callout:${harvest.id}:${v.id}`);
  }
  // Session confirmations
  for (const a of [byName("Graham", "Lister"), byName("Gary", "Pemberton")]) {
    push({ id: a.id, first: a.first, last: a.last, email: a.email }, nzInstant(addDays(TODAY, -4), "10:30"), T.sessionConfirmed({ firstName: a.first, moduleName: "Manual Handling", startsAt: sessionMH.startsAt, location: warehouse }));
  }

  await db.email.createMany({
    data: emails.map((e) => ({ volunteerId: e.volunteerId, channel: e.draft.channel ?? "EMAIL", toName: e.toName, toEmail: e.toEmail, createdAt: e.createdAt, kind: e.draft.kind, subject: e.draft.subject, preview: e.draft.preview, body: e.draft.body, ctaLabel: e.draft.ctaLabel ?? null, ctaHref: e.draft.ctaHref ?? null, ref: e.ref ?? null, status: "CAPTURED" as const })),
  });

  // Coordinator contact history ------------------------------------------------
  const logs: { v: { id: string }; kind: ContactLogKind; summary: string; at: Date }[] = [
    { v: tony, kind: "CALL", summary: "Called about the overdue Manual Handling refresher. Said he would do the online one this week.", at: nzInstant(addDays(TODAY, -9), "10:15") },
    { v: tony, kind: "NOTE", summary: "Happy to pick up Friday route cover when Debbie is away.", at: nzInstant(addDays(TODAY, -40), "13:02") },
    { v: margaret, kind: "CALL", summary: "Asked if she would buddy new volunteers on Tuesdays. Yes, keen.", at: nzInstant(addDays(TODAY, -16), "11:40") },
    { v: margaret, kind: "PROFILE_UPDATED", summary: "Updated emergency contact.", at: nzInstant(addDays(TODAY, -70), "09:30") },
    { v: byName("Steve", "Kirkwood"), kind: "ROLES_CHANGED", summary: "Added Volunteer driver. Training needed: Driver Licence Check.", at: nzInstant(addDays(TODAY, -300), "14:10") },
    { v: byName("Heather", "Lowe"), kind: "CALL", summary: "Rang in sick, chest infection. Marked away for the week.", at: nzInstant(TODAY, "06:45") },
  ];
  await db.contactLog.createMany({ data: logs.map((l) => ({ volunteerId: l.v.id, authorId: phillipa.id, kind: l.kind, summary: l.summary, createdAt: l.at })) });

  // Last-minute pushes and coordinator alerts for gaps already near their start,
  // generated by the same rules the app runs, recorded and never sent.
  const cover = await withCapturedEmails(() => runCoverChecks());

  // Restored last so nothing above can push to a real phone.
  const keyByEmail = new Map(PERSONAS.map((p) => [p.email, p.key]));
  for (const k of kept) {
    const v = vols.get(keyByEmail.get(k.email) ?? "");
    if (!v) continue;
    await db.session.createMany({ data: k.sessions.map((row) => ({ ...row, volunteerId: v.id })) });
    await db.pushToken.createMany({ data: k.pushTokens.map((row) => ({ ...row, volunteerId: v.id })) });
  }

  await db.meta.upsert({ where: { key: DEMO_SEEDED_ON }, update: { value: TODAY }, create: { key: DEMO_SEEDED_ON, value: TODAY } });

  console.log(`Seeded ${vols.size} volunteers, ${shifts.length} shifts, ${assignmentRows.length} assignments, ${recordRows.length} training records, ${emails.length} emails, ${cover.pushes} last-minute pushes, ${cover.escalations} uncovered alerts.`);
}

const DEMO_SEEDED_ON = "demoSeededOn";

/** Throws unless the database is empty of people or was last written by this
 *  seed, so real volunteers are never wiped. */
export async function assertDemoDatabase() {
  if (await db.meta.findUnique({ where: { key: DEMO_SEEDED_ON } })) return;
  const people = (await db.volunteer.count()) + (await db.application.count());
  if (people === 0) return;
  throw new Error(
    "Refusing to replace this database with demo data: it has volunteers or applications the demo seed did not create. " +
      "Check DATABASE_URL. To start a local database again from scratch, run `pnpm db:reset`.",
  );
}

/** Regenerates the demo when the NZ date has moved on since the last seed, or
 *  always when `force` is set. Returns whether it reseeded. */
export async function ensureDemoData({ force = false } = {}): Promise<boolean> {
  const seededOn = (await db.meta.findUnique({ where: { key: DEMO_SEEDED_ON } }))?.value;
  if (!force && seededOn === todayISO()) return false;
  await seedDemo();
  return true;
}
