// The volunteer Harvest page, shared by the web page and the native app: am I
// in the pool, what training harvests need, and what harvests are coming up.
import type { Volunteer } from "@/generated/prisma/client";
import { db } from "./db";
import { HARVEST_ROLE, inHarvestPool, joinRoles, parseRoles } from "./domain";
import { moduleStatuses } from "./training";
import { trainingContext, upcomingHarvests } from "./volunteer-data";

export async function loadHarvest(me: Volunteer, today: string) {
  const [training, harvests, poolCount] = await Promise.all([
    trainingContext(me, today),
    upcomingHarvests(today),
    db.volunteer.count({ where: { status: "ACTIVE", role: "VOLUNTEER", roles: { contains: HARVEST_ROLE } } }),
  ]);
  // Harvest training as it would stand in the pool, so someone thinking of
  // joining sees what it involves (and what they have already done).
  const asPicker = { roles: joinRoles([...parseRoles(me.roles), HARVEST_ROLE]) };
  const harvestTraining = moduleStatuses(asPicker, training.modules, training.records, today).filter((s) => parseRoles(s.module.requiredRoles).includes(HARVEST_ROLE));
  return {
    inPool: inHarvestPool(me),
    poolCount,
    harvestTraining,
    /** Every harvest training module is Complete or Due soon. */
    trained: harvestTraining.every((s) => s.status === "COMPLETE" || s.status === "DUE_SOON"),
    harvests,
    statuses: training.statuses,
  };
}
