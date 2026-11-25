import "server-only";
// A volunteer's roles and how long they have held each one. Volunteer.roles
// is what the booking gate reads; RolePeriod rows record when each role
// started and ended. Every change to Volunteer.roles goes through here so the
// two stay in step.
import type { Prisma, RolePeriod } from "@/generated/prisma/client";
import { db } from "./db";
import { dateToISO, isoToDate, todayISO } from "./dates";
import { sortRoles, type VolunteerRole } from "./domain";

type Tx = Prisma.TransactionClient;

/** Opens a period for each role, from `startedISO` (today by default). */
export async function openRolePeriods(tx: Tx, volunteerId: string, roles: readonly VolunteerRole[], startedISO: string = todayISO()) {
  if (roles.length === 0) return;
  await tx.rolePeriod.createMany({ data: roles.map((role) => ({ volunteerId, role, startedOn: isoToDate(startedISO) })) });
}

/** Sets a volunteer's roles, closing the periods of roles removed and opening
 *  periods for roles added. Returns what changed. */
export async function changeRoles(volunteerId: string, prev: readonly VolunteerRole[], roles: readonly VolunteerRole[], tx?: Tx) {
  const next = sortRoles(roles);
  const added = next.filter((r) => !prev.includes(r));
  const removed = prev.filter((r) => !next.includes(r));
  if (added.length + removed.length === 0) return { next, added, removed };
  const today = todayISO();
  const run = async (t: Tx) => {
    await t.volunteer.update({ where: { id: volunteerId }, data: { roles: next } });
    if (removed.length > 0) {
      await t.rolePeriod.updateMany({ where: { volunteerId, role: { in: removed }, endedOn: null }, data: { endedOn: isoToDate(today) } });
    }
    await openRolePeriods(t, volunteerId, added, today);
  };
  if (tx) await run(tx);
  else await db.$transaction(run);
  return { next, added, removed };
}

export type RoleTenure = { id: string; role: VolunteerRole; startedISO: string; endedISO: string | null };

/** Periods newest first: the roles they hold now, then past ones. */
export function roleTenures(periods: readonly RolePeriod[]): RoleTenure[] {
  return [...periods]
    .map((p) => ({ id: p.id, role: p.role, startedISO: dateToISO(p.startedOn), endedISO: p.endedOn ? dateToISO(p.endedOn) : null }))
    .sort((a, b) => Number(a.endedISO !== null) - Number(b.endedISO !== null) || b.startedISO.localeCompare(a.startedISO));
}

/** When they started each role they hold now. */
export function currentRoleStarts(periods: readonly RolePeriod[]): Partial<Record<VolunteerRole, string>> {
  const out: Partial<Record<VolunteerRole, string>> = {};
  for (const p of periods) {
    if (p.endedOn) continue;
    const iso = dateToISO(p.startedOn);
    if (!out[p.role] || iso < out[p.role]!) out[p.role] = iso;
  }
  return out;
}
