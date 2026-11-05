import type { TrainingOverview } from "@satisfy/core/api";
import { db } from "@/lib/db";
import { todayISO } from "@/lib/dates";
import { json, mobileHandler } from "@/lib/mobile-auth";
import { moduleSummary, trainingSessionItems } from "@/lib/mobile-api/training";
import { trainingContext } from "@/lib/volunteer-data";
import { inductionToDo } from "@/lib/induction";

export const dynamic = "force-dynamic";

export const GET = mobileHandler(async (me) => {
  const today = todayISO();
  const [{ statuses, summary, induction }, sessions] = await Promise.all([
    trainingContext(me, today),
    db.trainingSession.findMany({ where: { startsAt: { gte: new Date() } }, include: { module: true, rsvps: true }, orderBy: { startsAt: "asc" } }),
  ]);
  const required = statuses.filter((s) => s.required);
  const viewer = { me, induction };
  const summarise = (s: (typeof statuses)[number]) => moduleSummary(s, viewer);
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
    required: required.map(summarise),
    notRequired: statuses.filter((s) => !s.required && !s.module.inDevelopment).map(summarise),
    comingSoon: statuses.filter((s) => s.module.inDevelopment && s.module.requiredRoles.some((r) => me.roles.includes(r))).map(summarise),
    sessions: trainingSessionItems(sessions, statuses, me.id, viewer),
    induction: { complete: induction.complete, toDo: inductionToDo(induction) },
  });
});
