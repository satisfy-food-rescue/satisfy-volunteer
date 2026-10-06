// Satisfy's operational set-up: routes, donors, recipients, shift types and
// training modules. Used twice: the demo seed builds on it, and a fresh
// production database is given it once as a starting configuration, which
// coordinators then edit (Admin > Shift types and Admin > Training).
//
// The training module list is provisional: Phillipa is confirming which stages
// are in person and which are online (Oct 2026).
import type { Delivery, VolunteerRole } from "./domain";
import { INITIAL_VISIT_CODE } from "./domain";

export const ROUTES = [
  { key: "rk", name: "Rangiora / Kaiapoi", area: "Waimakariri", isVolunteerDriven: false, order: 1 },
  { key: "cn", name: "Christchurch North", area: "Christchurch City", isVolunteerDriven: false, order: 2 },
  { key: "hu", name: "Hurunui", area: "Hurunui", isVolunteerDriven: true, order: 3 },
] as const;

export type RouteKey = (typeof ROUTES)[number]["key"];

export const DONORS: { name: string; suburb: string; route: RouteKey }[] = [
  { name: "New World Rangiora", suburb: "Rangiora", route: "rk" },
  { name: "Countdown Rangiora", suburb: "Rangiora", route: "rk" },
  { name: "PAK'nSAVE Kaiapoi", suburb: "Kaiapoi", route: "rk" },
  { name: "New World Kaiapoi", suburb: "Kaiapoi", route: "rk" },
  { name: "Countdown Northwood", suburb: "Northwood", route: "cn" },
  { name: "PAK'nSAVE Northlands", suburb: "Papanui", route: "cn" },
  { name: "Four Square Amberley", suburb: "Amberley", route: "hu" },
];

export const RECIPIENTS = [
  { name: "Oxford Community Trust", location: "Oxford", kind: "Community trust" },
  { name: "Wai-Ora Trust", location: "Harewood", kind: "Community trust" },
  { name: "Thrive Church", location: "Rangiora", kind: "Church food bank" },
  { name: "Kaiapoi Community Pantry", location: "Kaiapoi", kind: "Food bank" },
  { name: "Hurunui Community Meals", location: "Amberley", kind: "Community meals" },
  { name: "Rangiora High School", location: "Rangiora", kind: "School" },
  { name: "Te Ngāi Tūāhuriri Rūnanga", location: "Tuahiwi", kind: "Iwi" },
];

export type ShiftTypeSpec = {
  key: string;
  kind: VolunteerRole;
  name: string;
  route: RouteKey | null;
  workingWith: string;
  lastMinuteHours: number;
  escalateHours: number;
  startTime: string;
  endTime: string;
  capacity: number;
  needed: number;
  weekdays: number[];
  order: number;
};

// Route shifts cannot run short-handed, so they notify and escalate earlier
// than the warehouse sort.
export const SHIFT_TYPES: ShiftTypeSpec[] = [
  { key: "warehouse-am", kind: "WAREHOUSE", name: "Warehouse sorting (AM)", route: null, workingWith: "Kim (warehouse supervisor)", lastMinuteHours: 48, escalateHours: 24, startTime: "09:00", endTime: "12:00", capacity: 10, needed: 6, weekdays: [1, 2, 3, 4, 5], order: 1 },
  { key: "da-rangiora-kaiapoi", kind: "DRIVERS_ASSISTANT", name: "Driver help: Rangiora / Kaiapoi", route: "rk", workingWith: "Dave (staff driver)", lastMinuteHours: 72, escalateHours: 36, startTime: "08:00", endTime: "11:30", capacity: 1, needed: 1, weekdays: [1, 2, 3, 4, 5], order: 2 },
  { key: "da-chch-north", kind: "DRIVERS_ASSISTANT", name: "Driver help: Christchurch North", route: "cn", workingWith: "Sam (staff driver)", lastMinuteHours: 72, escalateHours: 36, startTime: "08:30", endTime: "12:00", capacity: 1, needed: 1, weekdays: [1, 2, 3, 4, 5], order: 3 },
  { key: "da-hurunui", kind: "DRIVERS_ASSISTANT", name: "Driver help: Hurunui", route: "hu", workingWith: "the volunteer driver on the day", lastMinuteHours: 72, escalateHours: 36, startTime: "08:00", endTime: "12:30", capacity: 1, needed: 1, weekdays: [2, 4], order: 4 },
  { key: "vd-hurunui", kind: "VOLUNTEER_DRIVER", name: "Volunteer driver: Hurunui", route: "hu", workingWith: "a driver help volunteer", lastMinuteHours: 72, escalateHours: 48, startTime: "08:00", endTime: "12:30", capacity: 1, needed: 1, weekdays: [2, 4], order: 5 },
];

const ALL_ROLES: VolunteerRole[] = ["WAREHOUSE", "DRIVERS_ASSISTANT", "VOLUNTEER_DRIVER"];

export type ModuleSpec = {
  code: string;
  name: string;
  description: string;
  validityMonths: number | null;
  requiredRoles: VolunteerRole[];
  mandatoryBeforeFirstShift: boolean;
  delivery: Delivery;
  order: number;
  content?: string[];
};

export const TRAINING_MODULES: ModuleSpec[] = [
  { code: INITIAL_VISIT_CODE, name: "Initial Visit", description: "Your first visit to the warehouse, arranged one-to-one with the coordinator: orientation, emergency procedures, PPE, and how a sorting morning runs. Required before your first shift.", validityMonths: null, requiredRoles: ALL_ROLES, mandatoryBeforeFirstShift: true, delivery: "IN_PERSON", order: 1 },
  { code: "MANUAL_HANDLING", name: "Manual Handling", description: "Safe lifting and carrying of crates and boxes. Refreshed every 12 months.", validityMonths: 12, requiredRoles: ALL_ROLES, mandatoryBeforeFirstShift: false, delivery: "ONLINE_CONFIRM", order: 2, content: [
    "Plan the lift. Check the weight of a crate before you commit; if it is heavier than a full bag of groceries, get a second person or use the trolley.",
    "Keep the load close to your body, feet shoulder-width apart, and lift with your legs rather than your back. Avoid twisting while carrying; turn with your feet.",
    "Stack crates no higher than shoulder height. Heavier crates go on the bottom and middle shelves, lighter on top.",
    "Take breaks. Sorting is repetitive; swap stations every 45 minutes and say something if you feel a strain.",
  ] },
  { code: "FOOD_SAFETY", name: "Food Safety and Hygiene", description: "Handling rescued kai safely: temperature checks, use-by rules, allergen separation, and hand hygiene.", validityMonths: 12, requiredRoles: ["WAREHOUSE"], mandatoryBeforeFirstShift: false, delivery: "ONLINE_CONFIRM", order: 3, content: [
    "Wash hands on arrival, after breaks, and after handling raw or spoiled produce. Gloves are available at each station.",
    "Chilled kai must stay below 5 degrees. Anything that arrives warm or has been out of the chiller for more than two hours goes to compost, not to a recipient.",
    "Best-before dates are guidance and use-by dates are rules. We can pass on kai past its best-before if it looks and smells fine. We never pass on kai past its use-by.",
    "Keep allergen groups separate on the sorting table and label any repacked bags with their contents.",
  ] },
  { code: "SLIPS_TRIPS_FALLS", name: "Slips, Trips and Falls", description: "Keeping floors, ramps and the loading bay clear and dry. Refreshed every 12 months.", validityMonths: 12, requiredRoles: ALL_ROLES, mandatoryBeforeFirstShift: false, delivery: "ONLINE_CONFIRM", order: 4, content: [
    "Closed-toe shoes with grip every shift. No jandals, no slip-ons.",
    "Spills get dealt with immediately: cone it, mop it, dry it. The mop station is by the chiller door.",
    "Keep walkways clear. Empty crates go straight to the stack, not on the floor beside you.",
    "Use the ramp handrail in wet weather and never carry a load you cannot see over.",
  ] },
  { code: "ROUTE_VEHICLE_SAFETY", name: "Route and Vehicle Safety", description: "Loading the van, securing crates, store loading-dock etiquette, and what to do if something goes wrong on the road.", validityMonths: 12, requiredRoles: ["DRIVERS_ASSISTANT", "VOLUNTEER_DRIVER"], mandatoryBeforeFirstShift: false, delivery: "IN_PERSON", order: 5 },
  { code: "DRIVER_LICENCE_CHECK", name: "Driver Licence Check", description: "Coordinator sights a current full licence and records the expiry. Every 24 months.", validityMonths: 24, requiredRoles: ["VOLUNTEER_DRIVER"], mandatoryBeforeFirstShift: false, delivery: "IN_PERSON", order: 6 },
];

type Tx = Pick<typeof import("./db").db, "route" | "donor" | "recipient" | "shiftTemplate" | "trainingModule">;

/** Creates the reference data. Returns ids keyed by shift-type key and module
 *  code, for the demo seed to build on. */
export async function createReferenceData(db: Tx) {
  const routeIds = new Map<RouteKey, string>();
  for (const { key, ...r } of ROUTES) {
    routeIds.set(key, (await db.route.create({ data: r })).id);
  }
  await db.donor.createMany({ data: DONORS.map((d) => ({ name: d.name, suburb: d.suburb, routeId: routeIds.get(d.route)! })) });
  await db.recipient.createMany({ data: RECIPIENTS });
  const templateIds = new Map<string, string>();
  for (const { key, route, ...t } of SHIFT_TYPES) {
    templateIds.set(key, (await db.shiftTemplate.create({ data: { ...t, routeId: route ? routeIds.get(route)! : null } })).id);
  }
  const moduleIds = new Map<string, string>();
  for (const { content, ...m } of TRAINING_MODULES) {
    moduleIds.set(m.code, (await db.trainingModule.create({ data: { ...m, content: content?.join("\n\n") ?? null } })).id);
  }
  return { routeIds, templateIds, moduleIds };
}
