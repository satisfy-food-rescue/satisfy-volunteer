import type { CoverList } from "@satisfy/core/api";
import { todayISO } from "@/lib/dates";
import { json, mobileHandler } from "@/lib/mobile-auth";
import { shiftSummary } from "@/lib/mobile-api/shifts";
import { coverableGaps, trainingContext } from "@/lib/volunteer-data";

export const dynamic = "force-dynamic";

export const GET = mobileHandler(async (me) => {
  const today = todayISO();
  const [gaps, training] = await Promise.all([coverableGaps(me.id, today), trainingContext(me, today)]);
  const ctx = { me, statuses: training.statuses, today };
  return json<CoverList>({ today, shifts: gaps.map((g) => shiftSummary(g, ctx)) });
});
