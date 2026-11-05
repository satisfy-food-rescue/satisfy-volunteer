// The volunteer home screen, shared by the web page and the native app so the
// copy cannot drift: what to load, which alert to show and what to say when
// nothing is booked.
import type { Volunteer } from "@/generated/prisma/client";
import type { Home, HomeAlert } from "@satisfy/core/api";
import { db } from "./db";
import { formatDate, formatInstant } from "./dates";
import { inductionToDo, type Induction } from "./induction";
import { INITIAL_VISIT_CODE, inHarvestPool } from "./domain";
import { coverGaps, coverableGaps, myUpcomingShifts, myYear, trainingContext, upcomingHarvests } from "./volunteer-data";

type Summary = { overdue: number; notStarted: number; dueSoon: number };
/** The volunteer's booked initial visit, if any. */
type Visit = { startsAt: Date; location: string } | null;

/** The induction step that most needs doing, as an alert. A new volunteer
 *  is welcomed to it; for someone already volunteering it is a block. */
function inductionAlert(induction: Induction): HomeAlert | null {
  const { moj } = induction;
  const updated = induction.agreements.find((a) => a.status === "UPDATED");
  if (moj.status === "EXPIRED") return { tone: "bad", title: "Your Ministry of Justice check needs renewing", text: "New bookings are paused until we have a new one. Your regular slot keeps running. It is free and done online.", target: "induction" };
  if (updated) return { tone: "bad", title: `Please sign the updated ${updated.document.title}`, text: "New bookings are paused until you do. It only takes a minute.", target: "induction" };
  if (!induction.complete) return { tone: "info", title: "Start with your induction", text: `Before training or shifts, we need ${inductionToDo(induction)}.`, target: "induction" };
  if (moj.status === "RENEWAL_DUE") return { tone: "warn", title: "Time to renew your Ministry of Justice check", text: `It is three years old on ${formatDate(moj.renewsISO!)}. Request a new one now and nothing gets blocked.`, target: "induction" };
  return null;
}

export function homeAlert(s: Summary, needsVisit: boolean, visit: Visit, induction: Induction): HomeAlert | null {
  const ind = inductionAlert(induction);
  if (ind && ind.tone !== "warn") return ind;
  if (s.overdue > 0) return { tone: "bad", title: `${s.overdue} training ${s.overdue === 1 ? "refresher is" : "refreshers are"} overdue`, text: `New bookings for shifts that need ${s.overdue === 1 ? "it are blocked until it is" : "them are blocked until they are"} done. Most refreshers take ten minutes online.` };
  if (needsVisit && visit) return { tone: "info", title: `Your initial visit: ${formatInstant(visit.startsAt)}`, text: `At ${visit.location}. Shifts open up once your in-person training is done.` };
  if (needsVisit) return { tone: "info", title: "Your initial visit comes first", text: "Our coordinator will call to arrange your first visit to the warehouse, or you can book an open time. Shifts open up once your in-person training is done." };
  if (s.notStarted > 0) return { tone: "info", title: "Finish your training to start booking shifts", text: "Tick off the remaining modules. The online ones take about ten minutes each." };
  if (ind) return ind;
  if (s.dueSoon > 0) return { tone: "warn", title: `${s.dueSoon} refresher${s.dueSoon === 1 ? "" : "s"} due soon`, text: "Get ahead of it now and nothing will get blocked." };
  return null;
}

/** Shown in place of the next shift when nothing is booked. */
export function homeEmpty(s: Summary, needsVisit: boolean, visit: Visit, induction: Induction): Home["empty"] {
  const training = s.notStarted > 0;
  if (!induction.complete && (training || needsVisit)) {
    return { text: "Your induction comes first: once it is done, your training opens, then shifts.", cta: "Start my induction", target: "induction" };
  }
  return {
    text: training ? "Once your in-person training is done, you can pick a regular weekly slot or book one-off shifts." : "Browse the week and book a morning that suits.",
    cta: needsVisit && !visit ? "Book my initial visit" : training ? "Go to my training" : "Find a shift",
    target: training ? "training" : "shifts",
  };
}

export async function loadHome(me: Volunteer, today: string) {
  const [upcoming, training, gaps, harvests, visitRsvp, year] = await Promise.all([
    myUpcomingShifts(me.id, today),
    trainingContext(me, today),
    coverGaps(me.id, today),
    inHarvestPool(me) ? upcomingHarvests(today) : Promise.resolve([]),
    db.sessionRsvp.findFirst({ where: { volunteerId: me.id, status: "GOING", session: { startsAt: { gte: new Date() }, module: { code: INITIAL_VISIT_CODE } } }, include: { session: true } }),
    myYear(me.id, today),
  ]);
  const visit = visitRsvp?.session ?? null;
  const needsVisit = training.statuses.some((m) => m.module.code === INITIAL_VISIT_CODE && m.status === "NOT_STARTED");
  return {
    next: upcoming[0] ?? null,
    /** Booked shifts after the next one, for the home agenda. */
    later: upcoming.slice(1, 5),
    year,
    training,
    /** Gaps the volunteer could take now, for the cover card. */
    coverable: coverableGaps(gaps, { me, statuses: training.statuses, induction: training.induction, today }),
    /** The next harvest, for pool members: their own if booked, else the
     *  soonest with a place left. */
    harvest: harvests.find((h) => h.confirmed.some((a) => a.volunteerId === me.id)) ?? harvests.find((h) => !h.isFull) ?? null,
    alert: homeAlert(training.summary, needsVisit, visit, training.induction),
    empty: homeEmpty(training.summary, needsVisit, visit, training.induction),
  };
}
