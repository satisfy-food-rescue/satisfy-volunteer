// The volunteer pool: who the roster, the volunteer and training lists,
// announcements, callouts and reports count. Everyone with a volunteer
// account, plus coordinators who also volunteer (Volunteer.alsoVolunteers).
// A coordinator can hold both jobs, so their shifts and training show up
// wherever a volunteer's would.
import type { Prisma } from "@/generated/prisma/client";

/** Spread into a `where` to keep to the pool. */
export const IN_POOL = { OR: [{ role: "VOLUNTEER" }, { alsoVolunteers: true }] } satisfies Prisma.VolunteerWhereInput;

/** Active members of the pool. */
export const ACTIVE_POOL = { status: "ACTIVE", ...IN_POOL } satisfies Prisma.VolunteerWhereInput;

export function inVolunteerPool(v: { role: "ADMIN" | "VOLUNTEER"; alsoVolunteers: boolean }): boolean {
  return v.role === "VOLUNTEER" || v.alsoVolunteers;
}
