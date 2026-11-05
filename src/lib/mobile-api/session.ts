// Who is signed in, for the native app.
import type { Me, MobileSession } from "@satisfy/core/api";
import type { Volunteer } from "@/generated/prisma/client";
import { dateToISO, todayISO } from "../dates";
import { inHarvestPool, sortRoles } from "../domain";
import { isDemo } from "../env";
import { coverGaps, coverableGaps, trainingContext } from "../volunteer-data";
import { documentsFor } from "../documents";

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
    inHarvestPool: inHarvestPool(v),
    roles: sortRoles(v.roles),
    joinedISO: dateToISO(v.joinedAt),
  };
}

/** Badges count exactly what the web tab bar does (src/app/app/layout.tsx). */
export async function mobileSession(me: Volunteer): Promise<MobileSession> {
  const today = todayISO();
  const [gaps, training, documents] = await Promise.all([coverGaps(me.id, today), trainingContext(me, today), documentsFor(me)]);
  const coverable = coverableGaps(gaps, { me, statuses: training.statuses, induction: training.induction, today });
  return {
    me: meView(me),
    today,
    demo: isDemo(),
    badges: {
      cover: coverable.length,
      training: training.summary.overdue + training.summary.notStarted,
      induction: training.induction.outstanding,
      policies: documents.filter((d) => d.needsAction && d.document.kind === "POLICY").length,
    },
  };
}
