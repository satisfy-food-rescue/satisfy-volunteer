// Training views for the native app, matching src/app/app/training.
import type { ModuleSummary, TrainingSessionItem } from "@satisfy/core/api";
import type { TrainingModule, TrainingSession, SessionRsvp, Volunteer } from "@/generated/prisma/client";
import { formatInstant, formatInstantTime } from "../dates";
import { sessionWanted, type ModuleStatus } from "../training";
import { trainingLock, trainingLockOf, type Induction } from "../induction";

/** Who is asking, for what holds a module back. */
export type TrainingViewer = { me: Pick<Volunteer, "roles">; induction: Induction };

export function moduleSummary(s: ModuleStatus, viewer: TrainingViewer): ModuleSummary {
  const lock = s.status === "COMPLETE" ? null : trainingLockOf(viewer.me, s, viewer.induction);
  return {
    id: s.module.id,
    code: s.module.code,
    name: s.module.name,
    description: s.module.description,
    delivery: s.module.delivery,
    validityMonths: s.module.validityMonths,
    mandatoryBeforeFirstShift: s.module.mandatoryBeforeFirstShift,
    status: s.status,
    required: s.required,
    notApplicable: s.notApplicable,
    completedISO: s.completedISO,
    expiresISO: s.expiresISO,
    daysLeft: s.daysLeft,
    lockedReason: lock?.text ?? null,
    lockKind: lock?.kind ?? null,
    after: s.lockedBy ? { code: s.lockedBy.code, name: s.lockedBy.name, online: s.lockedBy.delivery === "ONLINE_CONFIRM" } : null,
  };
}

type SessionRow = TrainingSession & { module: TrainingModule; rsvps: SessionRsvp[] };

/** The sessions the volunteer still needs, plus any they have booked that
 *  they no longer need (so they can cancel), soonest first, as on the web. */
export function trainingSessionItems(sessions: SessionRow[], statuses: ModuleStatus[], meId: string, viewer: TrainingViewer): TrainingSessionItem[] {
  const isRelevant = (s: SessionRow) => sessionWanted(statuses.find((x) => x.module.id === s.moduleId));
  const booked = (s: SessionRow) => s.rsvps.some((r) => r.volunteerId === meId && r.status === "GOING");
  return sessions.filter((s) => isRelevant(s) || booked(s)).map((s) => {
    const mine = (s.rsvps.find((r) => r.volunteerId === meId)?.status ?? null) as TrainingSessionItem["mine"];
    const going = s.rsvps.filter((r) => r.status === "GOING").length;
    const st = statuses.find((x) => x.module.id === s.moduleId);
    return {
      id: s.id,
      moduleId: s.moduleId,
      moduleName: s.module.name,
      whenLabel: `${formatInstant(s.startsAt)} to ${formatInstantTime(s.endsAt)}`,
      startsAt: s.startsAt.toISOString(),
      location: s.location,
      capacity: s.capacity,
      going,
      mine,
      relevant: isRelevant(s),
      full: going >= s.capacity && mine !== "GOING",
      lockedReason: mine === "GOING" || !st ? null : trainingLock(viewer.me, st, viewer.induction),
    };
  });
}
