import type { Home } from "@satisfy/core/api";
import { IMPACT } from "@/lib/brand";
import { todayISO } from "@/lib/dates";
import { loadHome } from "@/lib/home";
import { json, mobileHandler } from "@/lib/mobile-auth";
import { shiftSummary } from "@/lib/mobile-api/shifts";

export const dynamic = "force-dynamic";

export const GET = mobileHandler(async (me) => {
  const today = todayISO();
  const { next, training, coverable, harvest, alert, empty } = await loadHome(me, today);
  const ctx = { me, statuses: training.statuses, today };
  return json<Home>({
    today,
    next: next ? shiftSummary(next, ctx) : null,
    empty,
    alert,
    cover: { count: coverable.length, next: coverable[0] ? { iso: coverable[0].iso, name: coverable[0].name } : null },
    harvest: harvest ? { id: harvest.shift.id, title: harvest.name, iso: harvest.iso, going: harvest.confirmed.some((a) => a.volunteerId === me.id) } : null,
    impact: { kgRescued: IMPACT.kgRescued, meals: IMPACT.meals, co2Tonnes: IMPACT.co2Tonnes, co2Period: IMPACT.co2Period, yearsRunning: IMPACT.yearsRunning },
  });
});
