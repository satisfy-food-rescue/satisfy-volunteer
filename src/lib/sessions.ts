// Training sessions on the roster and the home screens: every session for
// coordinators, and for a volunteer only the ones they have booked into.
import type { BookedSession } from "@satisfy/core/api";
import type { TrainingModule, TrainingSession, Volunteer } from "@/generated/prisma/client";
import { db } from "./db";
import { addDays, formatInstant, formatInstantRange, formatTimeRange, instantToISO, nzClock, nzInstant } from "./dates";

export type SessionView = {
  session: TrainingSession & { module: TrainingModule };
  /** The NZ calendar day it is on. */
  iso: string;
  /** "HH:MM" in NZ time, to sort beside shifts. */
  startTime: string;
  endTime: string;
  /** Everyone booked in, in the order they booked. */
  going: Volunteer[];
};

const include = { module: true, rsvps: { where: { status: "GOING" as const }, include: { volunteer: true }, orderBy: { createdAt: "asc" as const } } };
type Row = TrainingSession & { module: TrainingModule; rsvps: { volunteer: Volunteer }[] };

function toView({ rsvps, ...session }: Row): SessionView {
  return { session, iso: instantToISO(session.startsAt), startTime: nzClock(session.startsAt), endTime: nzClock(session.endsAt), going: rsvps.map((r) => r.volunteer) };
}

/** Sessions starting on the days from `fromISO` to `toISO` (NZ), soonest
 *  first. With `volunteerId`, only the ones that volunteer is booked into. */
export async function sessionsBetween(fromISO: string, toISO: string, opts: { volunteerId?: string } = {}): Promise<SessionView[]> {
  const rows = await db.trainingSession.findMany({
    where: {
      startsAt: { gte: nzInstant(fromISO, "00:00"), lt: nzInstant(addDays(toISO, 1), "00:00") },
      ...(opts.volunteerId ? { rsvps: { some: { volunteerId: opts.volunteerId, status: "GOING" } } } : {}),
    },
    include,
    orderBy: { startsAt: "asc" },
  });
  return rows.map(toView);
}

/** The sessions a volunteer has booked that are still to come. */
export async function myUpcomingSessions(volunteerId: string, take = 3): Promise<SessionView[]> {
  const now = new Date();
  const rows = await db.trainingSession.findMany({
    where: { startsAt: { gte: now }, rsvps: { some: { volunteerId, status: "GOING" } } },
    include,
    orderBy: { startsAt: "asc" },
    take,
  });
  return rows.map(toView);
}

/** A booked session as the native app shows it. */
export function bookedSession(v: SessionView): BookedSession {
  return {
    id: v.session.id,
    moduleName: v.session.module.name,
    iso: v.iso,
    whenLabel: formatInstantRange(v.session.startsAt, v.session.endsAt),
    startLabel: formatInstant(v.session.startsAt),
    timeLabel: formatTimeRange(v.startTime, v.endTime),
    location: v.session.location,
  };
}
