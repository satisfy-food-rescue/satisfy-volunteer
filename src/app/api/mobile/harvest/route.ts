import type { HarvestOverview } from "@satisfy/core/api";
import { todayISO } from "@/lib/dates";
import { loadHarvest } from "@/lib/harvest";
import { json, mobileHandler } from "@/lib/mobile-auth";
import { shiftSummary } from "@/lib/mobile-api/shifts";
import { moduleSummary } from "@/lib/mobile-api/training";

export const dynamic = "force-dynamic";

export const GET = mobileHandler(async (me) => {
  const today = todayISO();
  const h = await loadHarvest(me, today);
  const ctx = { me, statuses: h.statuses, today };
  return json<HarvestOverview>({
    today,
    inPool: h.inPool,
    poolCount: h.poolCount,
    training: h.harvestTraining.map(moduleSummary),
    trained: h.trained,
    harvests: h.harvests.map((v) => shiftSummary(v, ctx)),
  });
});
