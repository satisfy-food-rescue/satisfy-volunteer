import type { TrainingOverview } from "@satisfy/core/api";
import { db } from "@/lib/db";
import { todayISO } from "@/lib/dates";
import { json, mobileHandler } from "@/lib/mobile-auth";
import { moduleSummary, trainingSessionItems } from "@/lib/mobile-api/training";
import { trainingContext } from "@/lib/volunteer-data";

export const dynamic = "force-dynamic";

export const GET = mobileHandler(async (me) => {
  const today = todayISO();
  const [{ statuses, summary }, sessions] = await Promise.all([
    trainingContext(me, today),
    db.trainingSession.findMany({ where: { startsAt: { gte: new Date() } }, include: { module: true, rsvps: true }, orderBy: { startsAt: "asc" } }),
  ]);
  const required = statuses.filter((s) => s.required);
  return json<TrainingOverview>({
    today,
    summary: {
      overdue: summary.overdue,
      dueSoon: summary.dueSoon,
      notStarted: summary.notStarted,
      required: summary.required,
      current: required.filter((s) => s.status === "COMPLETE" || s.status === "DUE_SOON").length,
      compliant: summary.compliant,
    },
    required: required.map(moduleSummary),
    notRequired: statuses.filter((s) => !s.required).map(moduleSummary),
    sessions: trainingSessionItems(sessions, statuses, me.id),
  });
});
