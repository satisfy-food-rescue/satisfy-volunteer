// Who is signed in, for the native app.
import type { Me, MobileSession } from "@satisfy/core/api";
import type { Volunteer } from "@/generated/prisma/client";
import { dateToISO, formatInstant, todayISO } from "../dates";
import { parseRoles } from "../domain";
import { isDemo } from "../demo";
import { coverableGaps, trainingContext } from "../volunteer-data";

export function meView(v: Volunteer): Me {
  return {
    id: v.id,
    firstName: v.firstName,
    lastName: v.lastName,
    email: v.email,
    phone: v.phone,
    suburb: v.suburb,
    emergencyName: v.emergencyName,
    emergencyPhone: v.emergencyPhone,
    availabilityNote: v.availabilityNote,
    lastMinuteOk: v.lastMinuteOk,
    inHarvestPool: v.inHarvestPool,
    roles: parseRoles(v.roles),
    joinedISO: dateToISO(v.joinedAt),
    infoodle: v.infoodleId ? { id: v.infoodleId, syncedLabel: v.infoodleSyncedAt ? formatInstant(v.infoodleSyncedAt) : null } : null,
  };
}

/** Badges count exactly what the web tab bar does (src/app/app/layout.tsx). */
export async function mobileSession(me: Volunteer): Promise<MobileSession> {
  const today = todayISO();
  const [coverable, training] = await Promise.all([coverableGaps(me.id, today), trainingContext(me, today)]);
  return {
    me: meView(me),
    today,
    demo: isDemo(),
    badges: { cover: coverable.length, training: training.summary.overdue + training.summary.notStarted },
  };
}
