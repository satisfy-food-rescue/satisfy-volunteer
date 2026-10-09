import type { ShiftDetail } from "@satisfy/core/api";
import { db } from "@/lib/db";
import { todayISO } from "@/lib/dates";
import { failure, json, mobileHandler } from "@/lib/mobile-auth";
import { shiftDetail } from "@/lib/mobile-api/shifts";
import { shiftById } from "@/lib/roster";
import { trainingContext } from "@/lib/volunteer-data";

export const dynamic = "force-dynamic";

export const GET = mobileHandler<{ id: string }>(async (me, _request, { params }) => {
  const { id } = await params;
  const view = await shiftById(id);
  if (!view) return failure(404, "That shift no longer exists.");
  const today = todayISO();
  const [training, donors] = await Promise.all([
    trainingContext(me, today),
    view.shift.template.routeId ? db.donor.findMany({ where: { routeId: view.shift.template.routeId } }) : Promise.resolve([]),
  ]);
  return json<ShiftDetail>(shiftDetail(view, { me, statuses: training.statuses, today }, donors.map((d) => d.name)));
});
