// Shift views for the native app. The action is worked out here so the app
// never re-implements the booking rules.
import type { CrewMember, ShiftAction, ShiftDetail, ShiftSummary } from "@satisfy/core/api";
import type { VolunteerRole } from "@satisfy/core/domain";
import type { ShiftView } from "../roster";
import { eligibilityFor, type Eligibility, type ModuleStatus } from "../training";

/** Who is asking, and their training, to work out each shift's action. */
export type ShiftContext = { me: { id: string; roles: readonly VolunteerRole[] }; statuses: ModuleStatus[]; today: string };

/** The same decision, in the same order, as src/components/app/shift-actions.tsx. */
export function shiftAction(view: ShiftView, meId: string, elig: Eligibility, today: string): ShiftAction {
  if (view.iso < today) return { kind: "PAST" };
  if (view.shift.status === "CANCELLED") return { kind: "CANCELLED" };
  const mine = view.confirmed.find((a) => a.volunteerId === meId);
  if (mine) return { kind: "MINE", assignmentId: mine.id, source: mine.source };
  if (!elig.eligible) {
    return { kind: "BLOCKED", reason: elig.reason ?? "You are not eligible for this shift yet.", fix: elig.hasRole ? "training" : view.kind === "HARVEST" ? "harvestPool" : "role", moduleCode: elig.blockers[0]?.module.code ?? null };
  }
  if (view.isFull) return { kind: "FULL" };
  return { kind: "BOOK", cover: view.isGap };
}

export function shiftSummary(view: ShiftView, ctx: ShiftContext): ShiftSummary {
  const crew = view.confirmed.map(
    (a): CrewMember => ({
      assignmentId: a.id,
      volunteerId: a.volunteerId,
      firstName: a.volunteer.firstName,
      lastName: a.volunteer.lastName,
      source: a.source,
      isMe: a.volunteerId === ctx.me.id,
    }),
  );
  return {
    id: view.shift.id,
    iso: view.iso,
    kind: view.kind,
    name: view.name,
    startTime: view.shift.startTime,
    endTime: view.shift.endTime,
    location: view.location,
    capacity: view.shift.capacity,
    needed: view.shift.needed,
    confirmedCount: view.confirmedCount,
    spotsLeft: view.spotsLeft,
    isFull: view.isFull,
    isGap: view.isGap,
    shortBy: view.shortBy,
    // Only a gap is explained, as on the web, and never with the reason.
    causes: view.isGap ? view.crewCauses : [],
    crew,
    action: shiftAction(view, ctx.me.id, eligibilityFor(ctx.me, view.kind, ctx.statuses), ctx.today),
  };
}

export function shiftDetail(view: ShiftView, ctx: ShiftContext, stops: string[]): ShiftDetail {
  return {
    ...shiftSummary(view, ctx),
    notes: view.shift.notes,
    workingWith: view.shift.template.workingWith,
    volunteerDriven: view.shift.template.route?.isVolunteerDriven ?? false,
    stops,
  };
}
