import type { Home } from "@satisfy/core/api";
import { IMPACT } from "@/lib/brand";
import { dateToISO, todayISO } from "@/lib/dates";
import { loadHome } from "@/lib/home";
import { json, mobileHandler } from "@/lib/mobile-auth";
import { shiftSummary } from "@/lib/mobile-api/shifts";

export const dynamic = "force-dynamic";

export const GET = mobileHandler(async (me) => {
  const today = todayISO();
  const { next, training, coverable, callout, alert, empty } = await loadHome(me, today);
  const ctx = { me, statuses: training.statuses, today };
  return json<Home>({
    today,
    next: next ? shiftSummary(next, ctx) : null,
    empty,
    alert,
    cover: { count: coverable.length, next: coverable[0] ? { iso: coverable[0].iso, name: coverable[0].shift.template.name } : null },
    harvest: callout ? { id: callout.id, title: callout.title, iso: dateToISO(callout.date), going: callout.rsvps[0]?.status === "GOING" } : null,
    impact: { kgRescued: IMPACT.kgRescued, meals: IMPACT.meals, co2Tonnes: IMPACT.co2Tonnes, co2Period: IMPACT.co2Period, yearsRunning: IMPACT.yearsRunning },
  });
});
