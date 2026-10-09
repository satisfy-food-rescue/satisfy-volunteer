import type { HarvestOverview } from "@satisfy/core/api";
import { db } from "@/lib/db";
import { dateToISO, isoToDate, todayISO } from "@/lib/dates";
import { json, mobileHandler } from "@/lib/mobile-auth";

export const dynamic = "force-dynamic";

export const GET = mobileHandler(async (me) => {
  const today = todayISO();
  const [callouts, poolCount] = await Promise.all([
    db.harvestCallout.findMany({ where: { date: { gte: isoToDate(today) } }, include: { rsvps: { include: { volunteer: true } } }, orderBy: { date: "asc" } }),
    db.volunteer.count({ where: { inHarvestPool: true, status: "ACTIVE" } }),
  ]);
  return json<HarvestOverview>({
    today,
    inPool: me.inHarvestPool,
    poolCount,
    callouts: callouts.map((c) => ({
      id: c.id,
      title: c.title,
      iso: dateToISO(c.date),
      startTime: c.startTime,
      endTime: c.endTime,
      location: c.location,
      partner: c.partner,
      description: c.description,
      needed: c.needed,
      going: c.rsvps.filter((r) => r.status === "GOING").map((r) => ({ volunteerId: r.volunteerId, firstName: r.volunteer.firstName, lastName: r.volunteer.lastName })),
      mine: (c.rsvps.find((r) => r.volunteerId === me.id)?.status ?? null) as "GOING" | "DECLINED" | null,
    })),
  });
});
