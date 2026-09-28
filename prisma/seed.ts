// Demo seed. Everything is relative to today (NZ) so the demo never looks
// stale. Deterministic PRNG so a reseed on the same day is identical.
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import {
  addDays,
  addMonths,
  isoToDate,
  isWeekday,
  nzInstant,
  todayISO,
  weekdayOf,
  weekMonday,
} from "../src/lib/dates";
import { ABSENCE_REASON_LABEL, type AbsenceReason, type VolunteerRole } from "../src/lib/domain";
import * as T from "../src/lib/email-templates";

const db = new PrismaClient({
  adapter: new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
  }),
});

// ---------------------------------------------------------------------------
// Deterministic randomness
// ---------------------------------------------------------------------------
let seedState = 20261234;
function rand(): number {
  seedState |= 0;
  seedState = (seedState + 0x6d2b79f5) | 0;
  let t = Math.imul(seedState ^ (seedState >>> 15), 1 | seedState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const randInt = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];

const TODAY = todayISO();
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
  harvest?: boolean;
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

const VOLUNTEERS: VolSpec[] = [
  { key: "philippa", first: "Philippa", last: null, born: 1978, roles: ["WAREHOUSE"], admin: true, joinedYearsAgo: 3 },
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
  { first: "Te Aroha", last: "Waaka", lastMinute: true, born: 1975, roles: ["WAREHOUSE"], slots: [{ template: W, weekday: 3 }], harvest: true, joinedYearsAgo: 1 },
  { first: "Dennis", last: "Ford", born: 1953, roles: ["WAREHOUSE"], slots: [{ template: W, weekday: 3 }], joinedYearsAgo: 5 },
  { first: "Pauline", last: "Hewitt", born: 1956, roles: ["WAREHOUSE"], slots: [{ template: W, weekday: 3 }], joinedYearsAgo: 7 },
  // Thursday warehouse
  { first: "Barbara", last: "Kemp", born: 1954, roles: ["WAREHOUSE"], slots: [{ template: W, weekday: 4 }], joinedYearsAgo: 6 },
  { first: "Mike", last: "Sutherland", born: 1949, roles: ["WAREHOUSE"], slots: [{ template: W, weekday: 4 }], joinedYearsAgo: 10 },
  { first: "Anne", last: "Whitfield", born: 1962, roles: ["WAREHOUSE"], slots: [{ template: W, weekday: 4 }], joinedYearsAgo: 3 },
  { first: "Sione", last: "Tuilagi", lastMinute: true, born: 1980, roles: ["WAREHOUSE"], slots: [{ template: W, weekday: 4 }], harvest: true, joinedYearsAgo: 1 },
  // Friday warehouse
  { first: "Ngaire", last: "Puketapu", born: 1957, roles: ["WAREHOUSE"], slots: [{ template: W, weekday: 5 }], joinedYearsAgo: 4 },
  { first: "Frank", last: "Doyle", born: 1948, roles: ["WAREHOUSE"], slots: [{ template: W, weekday: 5 }], joinedYearsAgo: 9 },
  { first: "Robyn", last: "Ashworth", born: 1959, roles: ["WAREHOUSE"], slots: [{ template: W, weekday: 5 }], joinedYearsAgo: 2 },
  { first: "Kevin", last: "Marshall", born: 1955, roles: ["WAREHOUSE"], slots: [{ template: W, weekday: 5 }], joinedYearsAgo: 5 },
  { first: "Liz", last: "Stratford", born: 1968, roles: ["WAREHOUSE"], slots: [{ template: W, weekday: 5 }], joinedYearsAgo: 1 },
  // Driver's assistants, Rangiora / Kaiapoi route
  { first: "Trevor", last: "Hansen", born: 1952, roles: ["WAREHOUSE", "DRIVERS_ASSISTANT"], slots: [{ template: DA_RK, weekday: 1 }], joinedYearsAgo: 7 },
  { first: "Moana", last: "Rikihana", lastMinute: true, born: 1970, roles: ["WAREHOUSE", "DRIVERS_ASSISTANT"], slots: [{ template: DA_RK, weekday: 2 }], joinedYearsAgo: 2 },
  { key: "tony", first: "Tony", last: "Ratana", born: 1963, roles: ["WAREHOUSE", "DRIVERS_ASSISTANT"], slots: [{ template: DA_RK, weekday: 3 }], joinedYearsAgo: 3, notes: "Knows the Kaiapoi stores well. Sometimes covers Fridays." },
  { first: "Ian", last: "Carmichael", born: 1954, roles: ["WAREHOUSE", "DRIVERS_ASSISTANT"], slots: [{ template: DA_RK, weekday: 4 }], joinedYearsAgo: 5 },
  { first: "Debbie", last: "Ryan", born: 1965, roles: ["WAREHOUSE", "DRIVERS_ASSISTANT"], slots: [{ template: DA_RK, weekday: 5 }], joinedYearsAgo: 4 },
  // Driver's assistants, Christchurch North route
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
  { first: "Emma", last: "Whitcombe", lastMinute: true, born: 1992, roles: ["WAREHOUSE"], harvest: true, joinedYearsAgo: 1, availability: "Weekends and school holidays for harvests." },
  { first: "Josh", last: "Tairoa", lastMinute: true, born: 1988, roles: ["WAREHOUSE"], harvest: true, joinedYearsAgo: 2 },
  { first: "Fiona", last: "Grant", lastMinute: true, born: 1971, roles: ["WAREHOUSE"], harvest: true, joinedYearsAgo: 4 },
  { first: "Ravi", last: "Naidoo", lastMinute: true, born: 1979, roles: ["WAREHOUSE"], harvest: true, joinedYearsAgo: 1 },
  // Brand-new volunteer, approved from Infoodle two days ago, no training yet
  { key: "jess", first: "Jess", last: "Moorhouse", born: 2001, roles: ["WAREHOUSE"], joinedYearsAgo: 0, availability: "Tuesday and Thursday mornings during uni term." },
];

// ---------------------------------------------------------------------------
async function main() {
  console.log(`Seeding Satisfy demo relative to ${TODAY}`);

  // Wipe in dependency order.
  await db.email.deleteMany();
  await db.harvestRsvp.deleteMany();
  await db.harvestCallout.deleteMany();
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

  // Routes and donors --------------------------------------------------------
  const routeRK = await db.route.create({
    data: { name: "Rangiora / Kaiapoi", area: "Waimakariri", driverName: "Dave (staff driver)", order: 1 },
  });
  const routeCN = await db.route.create({
    data: { name: "Christchurch North", area: "Christchurch City", driverName: "Sam (staff driver)", order: 2 },
  });
  const routeHU = await db.route.create({
    data: { name: "Hurunui", area: "Hurunui", driverName: null, isVolunteerDriven: true, order: 3 },
  });
  await db.donor.createMany({
    data: [
      { name: "New World Rangiora", suburb: "Rangiora", routeId: routeRK.id },
      { name: "Countdown Rangiora", suburb: "Rangiora", routeId: routeRK.id },
      { name: "PAK'nSAVE Kaiapoi", suburb: "Kaiapoi", routeId: routeRK.id },
      { name: "New World Kaiapoi", suburb: "Kaiapoi", routeId: routeRK.id },
      { name: "Countdown Northwood", suburb: "Northwood", routeId: routeCN.id },
      { name: "PAK'nSAVE Northlands", suburb: "Papanui", routeId: routeCN.id },
      { name: "Four Square Amberley", suburb: "Amberley", routeId: routeHU.id },
    ],
  });
  await db.recipient.createMany({
    data: [
      { name: "Oxford Community Trust", location: "Oxford", kind: "Community trust" },
      { name: "Wai-Ora Trust", location: "Harewood", kind: "Community trust" },
      { name: "Thrive Church", location: "Rangiora", kind: "Church food bank" },
      { name: "Kaiapoi Community Pantry", location: "Kaiapoi", kind: "Food bank" },
      { name: "Hurunui Community Meals", location: "Amberley", kind: "Community meals" },
      { name: "Rangiora High School", location: "Rangiora", kind: "School" },
      { name: "Te Ngāi Tūāhuriri Rūnanga", location: "Tuahiwi", kind: "Iwi" },
    ],
  });

  // Shift templates ----------------------------------------------------------
  const templateSpecs = [
    { key: W, kind: "WAREHOUSE", name: "Warehouse sorting (AM)", routeId: null, start: "09:00", end: "12:00", capacity: 10, needed: 6, weekdays: "1,2,3,4,5", order: 1 },
    { key: DA_RK, kind: "DRIVERS_ASSISTANT", name: "Driver's assistant: Rangiora / Kaiapoi", routeId: routeRK.id, start: "08:00", end: "11:30", capacity: 1, needed: 1, weekdays: "1,2,3,4,5", order: 2 },
    { key: DA_CN, kind: "DRIVERS_ASSISTANT", name: "Driver's assistant: Christchurch North", routeId: routeCN.id, start: "08:30", end: "12:00", capacity: 1, needed: 1, weekdays: "1,2,3,4,5", order: 3 },
    { key: DA_HU, kind: "DRIVERS_ASSISTANT", name: "Driver's assistant: Hurunui", routeId: routeHU.id, start: "08:00", end: "12:30", capacity: 1, needed: 1, weekdays: "2,4", order: 4 },
    { key: VD_HU, kind: "VOLUNTEER_DRIVER", name: "Volunteer driver: Hurunui", routeId: routeHU.id, start: "08:00", end: "12:30", capacity: 1, needed: 1, weekdays: "2,4", order: 5 },
  ] as const;
  const templates = new Map<string, { id: string; kind: string; name: string; start: string; end: string; capacity: number; needed: number; weekdays: number[] }>();
  for (const t of templateSpecs) {
    const row = await db.shiftTemplate.create({
      data: { kind: t.kind, name: t.name, routeId: t.routeId, startTime: t.start, endTime: t.end, capacity: t.capacity, needed: t.needed, weekdays: t.weekdays, order: t.order },
    });
    templates.set(t.key, { id: row.id, kind: t.kind, name: t.name, start: t.start, end: t.end, capacity: t.capacity, needed: t.needed, weekdays: t.weekdays.split(",").map(Number) });
  }

  // Training modules ---------------------------------------------------------
  const moduleSpecs = [
    { code: "INDUCTION", name: "Induction and Health & Safety", description: "Warehouse orientation, emergency procedures, PPE, and how a sorting morning runs. Required before your first shift.", validityMonths: null, requiredRoles: "WAREHOUSE,DRIVERS_ASSISTANT,VOLUNTEER_DRIVER", mandatory: true, delivery: "IN_PERSON", order: 1 },
    { code: "MANUAL_HANDLING", name: "Manual Handling", description: "Safe lifting and carrying of crates and boxes. Refreshed every 12 months.", validityMonths: 12, requiredRoles: "WAREHOUSE,DRIVERS_ASSISTANT,VOLUNTEER_DRIVER", mandatory: false, delivery: "ONLINE_CONFIRM", order: 2, content: [
      "Plan the lift. Check the weight of a crate before you commit; if it is heavier than a full bag of groceries, get a second person or use the trolley.",
      "Keep the load close to your body, feet shoulder-width apart, and lift with your legs rather than your back. Avoid twisting while carrying; turn with your feet.",
      "Stack crates no higher than shoulder height. Heavier crates go on the bottom and middle shelves, lighter on top.",
      "Take breaks. Sorting is repetitive; swap stations every 45 minutes and say something if you feel a strain.",
    ] },
    { code: "FOOD_SAFETY", name: "Food Safety and Hygiene", description: "Handling rescued kai safely: temperature checks, use-by rules, allergen separation, and hand hygiene.", validityMonths: 12, requiredRoles: "WAREHOUSE", mandatory: false, delivery: "ONLINE_CONFIRM", order: 3, content: [
      "Wash hands on arrival, after breaks, and after handling raw or spoiled produce. Gloves are available at each station.",
      "Chilled kai must stay below 5 degrees. Anything that arrives warm or has been out of the chiller for more than two hours goes to compost, not to a recipient.",
      "Best-before dates are guidance and use-by dates are rules. We can pass on kai past its best-before if it looks and smells fine. We never pass on kai past its use-by.",
      "Keep allergen groups separate on the sorting table and label any repacked bags with their contents.",
    ] },
    { code: "SLIPS_TRIPS_FALLS", name: "Slips, Trips and Falls", description: "Keeping floors, ramps and the loading bay clear and dry. Refreshed every 12 months.", validityMonths: 12, requiredRoles: "WAREHOUSE,DRIVERS_ASSISTANT,VOLUNTEER_DRIVER", mandatory: false, delivery: "ONLINE_CONFIRM", order: 4, content: [
      "Closed-toe shoes with grip every shift. No jandals, no slip-ons.",
      "Spills get dealt with immediately: cone it, mop it, dry it. The mop station is by the chiller door.",
      "Keep walkways clear. Empty crates go straight to the stack, not on the floor beside you.",
      "Use the ramp handrail in wet weather and never carry a load you cannot see over.",
    ] },
    { code: "ROUTE_VEHICLE_SAFETY", name: "Route and Vehicle Safety", description: "Loading the van, securing crates, store loading-dock etiquette, and what to do if something goes wrong on the road.", validityMonths: 12, requiredRoles: "DRIVERS_ASSISTANT,VOLUNTEER_DRIVER", mandatory: false, delivery: "IN_PERSON", order: 5 },
    { code: "DRIVER_LICENCE_CHECK", name: "Driver Licence Check", description: "Coordinator sights a current full licence and records the expiry. Every 24 months.", validityMonths: 24, requiredRoles: "VOLUNTEER_DRIVER", mandatory: false, delivery: "IN_PERSON", order: 6 },
  ];
  const modules = new Map<string, { id: string; name: string; validityMonths: number | null; requiredRoles: string[]; delivery: string }>();
  for (const m of moduleSpecs) {
    const row = await db.trainingModule.create({
      data: { code: m.code, name: m.name, description: m.description, validityMonths: m.validityMonths, requiredRoles: m.requiredRoles, mandatoryBeforeFirstShift: m.mandatory, delivery: m.delivery, order: m.order, content: "content" in m && m.content ? m.content.join("\n\n") : null },
    });
    modules.set(m.code, { id: row.id, name: m.name, validityMonths: m.validityMonths, requiredRoles: m.requiredRoles.split(","), delivery: m.delivery });
  }

  // Volunteers ---------------------------------------------------------------
  const vols = new Map<string, { id: string; first: string; last: string | null; email: string; roles: VolunteerRole[]; spec: VolSpec }>();
  const syncedAt = nzInstant(TODAY, "06:00");
  let infoodleSeq = 1041;
  for (const v of VOLUNTEERS) {
    const email = v.key === "philippa" ? "philippa@satisfyfoodrescue.org.nz" : emailFor(v.first, v.last ?? "volunteer");
    const yearsAgo = v.joinedYearsAgo ?? 2;
    const joined = v.key === "jess" ? isoToDate(addDays(TODAY, -2)) : isoToDate(addDays(TODAY, -(yearsAgo * 365 + randInt(0, 200))));
    const row = await db.volunteer.create({
      data: {
        personaKey: v.key ?? null,
        firstName: v.first,
        lastName: v.last,
        email,
        phone: phone(),
        suburb: pick(SUBURBS),
        birthYear: v.born,
        role: v.admin ? "ADMIN" : "VOLUNTEER",
        roles: v.roles.join(","),
        isRegular: (v.slots?.length ?? 0) > 0,
        inHarvestPool: v.harvest ?? false,
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
  const philippa = vols.get("philippa")!;
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
    const iso = s.date.toISOString().slice(0, 10);
    shiftsByDate.set(iso, [...(shiftsByDate.get(iso) ?? []), s]);
  }

  // Assignments from regular slots ------------------------------------------
  const assignmentRows: { shiftId: string; volunteerId: string; source: string; status: string; absenceId?: string | null; createdAt?: Date }[] = [];
  for (const s of shifts) {
    const iso = s.date.toISOString().slice(0, 10);
    const wd = weekdayOf(iso);
    const regulars = slotIndex.get(`${s.templateId}:${wd}`) ?? [];
    const past = iso < TODAY;
    for (const volunteerId of regulars) {
      // Skip Jess-style newcomers (none have slots) and skip volunteers before their join date.
      let status = "CONFIRMED";
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
        const iso = a.shift.date.toISOString().slice(0, 10);
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
  const inductionISO = nextWeekday(addDays(TODAY, 5));
  const mhISO = nextWeekday(addDays(TODAY, 9));
  const rvsISO = nextWeekday(addDays(TODAY, 16));
  const pastSessionISO = nextWeekday(addDays(TODAY, -20));
  const warehouse = "Satisfy warehouse, Rangiora";
  const sessionInduction = await db.trainingSession.create({ data: { moduleId: modules.get("INDUCTION")!.id, startsAt: nzInstant(inductionISO, "10:00"), endsAt: nzInstant(inductionISO, "12:00"), location: warehouse, capacity: 8, notes: "Includes a walk-through of the sorting floor and chiller." } });
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

  const recordRows: { volunteerId: string; moduleId: string; completedAt: Date; expiresAt: Date | null; method: string; sessionId?: string | null }[] = [];
  for (const v of vols.values()) {
    if (v.id === jess.id) continue;
    for (const m of modules.values()) {
      if (!m.requiredRoles.some((r) => v.roles.includes(r as VolunteerRole))) continue;
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
      const method = m.delivery === "ONLINE_CONFIRM" ? (rand() < 0.8 ? "ONLINE" : "SESSION") : code === "DRIVER_LICENCE_CHECK" ? "COORDINATOR" : "SESSION";
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

  // Harvest callout ----------------------------------------------------------
  const harvestISO = nextWeekday(addDays(TODAY, 10));
  const callout = await db.harvestCallout.create({
    data: {
      title: "Apple picking at a Loburn orchard",
      date: isoToDate(harvestISO),
      startTime: "09:00",
      endTime: "12:30",
      location: "Loburn, 15 minutes north of Rangiora",
      partner: "Food Secure North Canterbury",
      description: "A home orchard with more apples than the family can use. We expect around 400 kg. Ladders, picking bags and crates provided. Wear sturdy shoes and bring a hat.",
      needed: 8,
    },
  });
  for (const a of [byName("Emma", "Whitcombe"), byName("Josh", "Tairoa"), byName("Te Aroha", "Waaka")]) {
    await db.harvestRsvp.create({ data: { calloutId: callout.id, volunteerId: a.id, status: "GOING" } });
  }
  await db.harvestRsvp.create({ data: { calloutId: callout.id, volunteerId: byName("Fiona", "Grant").id, status: "DECLINED" } });

  // Applications -------------------------------------------------------------
  await db.application.createMany({
    data: [
      { firstName: "Aroha", lastName: "Ngata", email: "aroha.ngata@example.nz", phone: phone(), suburb: "Kaiapoi", birthYear: 1969, interests: "WAREHOUSE,DRIVERS_ASSISTANT", availability: "Monday, Wednesday and Friday mornings", message: "Recently retired from the DHB and keen to do something practical for the community. I have a full licence and do not mind early starts.", infoodleId: "IF-1102", submittedAt: nzInstant(addDays(TODAY, -1), "19:42") },
      { firstName: "Callum", lastName: "Reid", email: "callum.reid@example.nz", phone: phone(), suburb: "Rangiora", birthYear: 1996, interests: "WAREHOUSE", availability: "Tuesdays and Thursdays before 1pm", message: "Shift worker at the hospital, free most weekday mornings. Heard about you through Thrive Church.", infoodleId: "IF-1101", submittedAt: nzInstant(addDays(TODAY, -3), "08:15") },
      { firstName: "Priya", lastName: "Sharma", email: "priya.sharma@example.nz", phone: phone(), suburb: "Pegasus", birthYear: 1985, interests: "WAREHOUSE", availability: "Any weekday morning while the kids are at school", message: null, infoodleId: "IF-1100", submittedAt: nzInstant(addDays(TODAY, -6), "13:05") },
      { firstName: "Jess", lastName: "Moorhouse", email: jess.email, phone: phone(), suburb: "Rangiora", birthYear: 2001, interests: "WAREHOUSE", availability: "Tuesday and Thursday mornings during uni term", message: "Studying environmental science at Lincoln, want to help reduce food waste locally.", infoodleId: "IF-1099", submittedAt: nzInstant(addDays(TODAY, -5), "17:30"), status: "APPROVED", reviewedAt: nzInstant(addDays(TODAY, -2), "09:10"), volunteerId: jess.id },
      { firstName: "Mark", lastName: "Eldridge", email: "mark.eldridge@example.nz", phone: phone(), suburb: "Christchurch Central", birthYear: 1990, interests: "VOLUNTEER_DRIVER", availability: "Weekends only", message: "Only free on weekends.", infoodleId: "IF-1098", submittedAt: nzInstant(addDays(TODAY, -12), "21:00"), status: "DECLINED", reviewedAt: nzInstant(addDays(TODAY, -10), "10:00"), reviewNote: "Weekend-only availability; we operate Monday to Friday. Suggested the harvest pool and Christchurch City Mission." },
    ],
  });

  // Outbox emails ------------------------------------------------------------
  const emails: { volunteerId: string | null; toName: string; toEmail: string; createdAt: Date; draft: T.EmailDraft }[] = [];
  const push = (v: { id: string; first: string; last: string | null; email: string } | null, createdAt: Date, draft: T.EmailDraft) =>
    emails.push({ volunteerId: v?.id ?? null, toName: v ? `${v.first}${v.last ? " " + v.last : ""}` : "Philippa", toEmail: v?.email ?? philippa.email, createdAt, draft });

  const records = await db.trainingRecord.findMany({ where: { expiresAt: { not: null } }, include: { module: true, volunteer: true } });
  for (const r of records) {
    const expISO = r.expiresAt!.toISOString().slice(0, 10);
    const days = Math.round((isoToDate(expISO).getTime() - isoToDate(TODAY).getTime()) / 86_400_000);
    const v = { id: r.volunteer.id, first: r.volunteer.firstName, last: r.volunteer.lastName, email: r.volunteer.email };
    const online = r.module.delivery === "ONLINE_CONFIRM";
    if (days > 0 && days <= 30) {
      push(v, nzInstant(addDays(expISO, -30), "07:00"), T.trainingDueSoon({ firstName: v.first, moduleName: r.module.name, expiresISO: expISO, daysLeft: 30, online }));
    } else if (days <= 0) {
      const blocks = r.module.requiredRoles.includes("WAREHOUSE") ? "new shifts" : "route shifts";
      push(v, nzInstant(addDays(expISO, -30), "07:00"), T.trainingDueSoon({ firstName: v.first, moduleName: r.module.name, expiresISO: expISO, daysLeft: 30, online }));
      for (let d = expISO; d <= TODAY; d = addDays(d, 7)) {
        push(v, nzInstant(d, "07:00"), T.trainingOverdue({ firstName: v.first, moduleName: r.module.name, expiredISO: expISO, online, blocks }));
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
  push(null, nzInstant(TODAY, "06:48"), T.gapAlert({ shiftName: heatherShift.shift.template.name, dateISO: heatherShift.shift.date.toISOString().slice(0, 10), start: heatherShift.shift.startTime, end: heatherShift.shift.endTime, cause: "Heather Lowe marked away (sick)", shiftId: heatherShift.shiftId }));
  const brian = byName("Brian", "Tweedie");
  push({ id: brian.id, first: brian.first, last: brian.last, email: brian.email }, nzInstant(addDays(TODAY, -6), "11:20"), T.absenceConfirmed({ firstName: "Brian", startISO: addDays(TODAY, 3), endISO: addDays(TODAY, 12), reasonLabel: ABSENCE_REASON_LABEL.HOLIDAY, releasedCount: 2 }));
  // Ngaire covered by Fiona.
  const fiona = byName("Fiona", "Grant");
  const fionaCover = (await db.assignment.findFirst({ where: { volunteerId: fiona.id, source: "COVER", status: "CONFIRMED" }, include: { shift: { include: { template: true } } } }))!;
  push({ id: fiona.id, first: fiona.first, last: fiona.last, email: fiona.email }, nzInstant(addDays(TODAY, -1), "15:12"), T.coverConfirmed({ firstName: "Fiona", shiftName: fionaCover.shift.template.name, dateISO: fionaCover.shift.date.toISOString().slice(0, 10), start: fionaCover.shift.startTime, end: fionaCover.shift.endTime, shiftId: fionaCover.shiftId }));
  // Jess approved + welcome
  push({ id: jess.id, first: jess.first, last: jess.last, email: jess.email }, nzInstant(addDays(TODAY, -2), "09:10"), T.applicationApproved({ firstName: "Jess", inductionAt: sessionInduction.startsAt, inductionLocation: warehouse }));
  push({ id: jess.id, first: jess.first, last: jess.last, email: jess.email }, nzInstant(addDays(TODAY, -2), "09:11"), T.welcome({ firstName: "Jess" }));
  // Harvest callout to the pool
  for (const v of vols.values()) {
    if (!v.spec.harvest) continue;
    push({ id: v.id, first: v.first, last: v.last, email: v.email }, nzInstant(addDays(TODAY, -2), "12:00"), T.harvestCallout({ firstName: v.first, title: callout.title, dateISO: harvestISO, start: callout.startTime, end: callout.endTime, location: callout.location, partner: callout.partner }));
  }
  // Session confirmations
  for (const a of [byName("Graham", "Lister"), byName("Gary", "Pemberton")]) {
    push({ id: a.id, first: a.first, last: a.last, email: a.email }, nzInstant(addDays(TODAY, -4), "10:30"), T.sessionConfirmed({ firstName: a.first, moduleName: "Manual Handling", startsAt: sessionMH.startsAt, location: warehouse }));
  }

  await db.email.createMany({
    data: emails.map((e) => ({ volunteerId: e.volunteerId, toName: e.toName, toEmail: e.toEmail, createdAt: e.createdAt, kind: e.draft.kind, subject: e.draft.subject, preview: e.draft.preview, body: e.draft.body, ctaLabel: e.draft.ctaLabel ?? null, ctaHref: e.draft.ctaHref ?? null })),
  });

  await db.meta.create({ data: { key: "seededOn", value: TODAY } });

  console.log(`Seeded ${vols.size} volunteers, ${shifts.length} shifts, ${assignmentRows.length} assignments, ${recordRows.length} training records, ${emails.length} emails.`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
