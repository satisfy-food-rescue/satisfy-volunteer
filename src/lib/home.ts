// The volunteer home screen, shared by the web page and the native app so the
// copy cannot drift: what to load, which alert to show and what to say when
// nothing is booked.
import type { Volunteer } from "@/generated/prisma/client";
import type { Home, HomeAlert } from "@satisfy/core/api";
import { db } from "./db";
import { formatInstant, isoToDate } from "./dates";
import { INITIAL_VISIT_CODE } from "./domain";
import { coverableGaps, myUpcomingShifts, trainingContext } from "./volunteer-data";

type Summary = { overdue: number; notStarted: number; dueSoon: number };
/** The volunteer's booked initial visit, if any. */
type Visit = { startsAt: Date; location: string } | null;

export function homeAlert(s: Summary, needsVisit: boolean, visit: Visit): HomeAlert | null {
  if (s.overdue > 0) return { tone: "bad", title: `${s.overdue} training ${s.overdue === 1 ? "refresher is" : "refreshers are"} overdue`, text: "Route shifts are blocked until it is done. Most refreshers take ten minutes online." };
  if (needsVisit && visit) return { tone: "info", title: `Your initial visit: ${formatInstant(visit.startsAt)}`, text: `At ${visit.location}. Shifts open up once your in-person training is done.` };
  if (needsVisit) return { tone: "info", title: "Your initial visit comes first", text: "Our coordinator will call to arrange your first visit to the warehouse, or you can book an open time. Shifts open up once your in-person training is done." };
  if (s.notStarted > 0) return { tone: "info", title: "Finish your training to start booking shifts", text: "Tick off the remaining modules. The online ones take about ten minutes each." };
  if (s.dueSoon > 0) return { tone: "warn", title: `${s.dueSoon} refresher${s.dueSoon === 1 ? "" : "s"} due soon`, text: "Get ahead of it now and nothing will get blocked." };
  return null;
}

/** Shown in place of the next shift when nothing is booked. */
export function homeEmpty(s: Summary, needsVisit: boolean, visit: Visit): Home["empty"] {
  const training = s.notStarted > 0;
  return {
    text: training ? "Once your in-person training is done, you can pick a regular weekly slot or book one-off shifts." : "Browse the week and book a morning that suits.",
    cta: needsVisit && !visit ? "Book my initial visit" : training ? "Go to my training" : "Find a shift",
    target: training ? "training" : "shifts",
  };
}

export async function loadHome(me: Volunteer, today: string) {
  const [upcoming, training, coverable, callouts, visitRsvp] = await Promise.all([
    myUpcomingShifts(me.id, today),
    trainingContext(me, today),
    coverableGaps(me.id, today),
    me.inHarvestPool
      ? db.harvestCallout.findMany({ where: { date: { gte: isoToDate(today) } }, include: { rsvps: { where: { volunteerId: me.id } } }, orderBy: { date: "asc" }, take: 1 })
      : Promise.resolve([]),
    db.sessionRsvp.findFirst({ where: { volunteerId: me.id, status: "GOING", session: { startsAt: { gte: new Date() }, module: { code: INITIAL_VISIT_CODE } } }, include: { session: true } }),
  ]);
  const visit = visitRsvp?.session ?? null;
  const needsVisit = training.statuses.some((m) => m.module.code === INITIAL_VISIT_CODE && m.status === "NOT_STARTED");
  return {
    next: upcoming[0] ?? null,
    training,
    coverable,
    callout: callouts[0] ?? null,
    alert: homeAlert(training.summary, needsVisit, visit),
    empty: homeEmpty(training.summary, needsVisit, visit),
  };
}
