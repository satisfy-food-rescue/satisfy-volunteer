// Callouts for one-off shifts. When a coordinator publishes a shift and asks
// for a callout, every active volunteer who holds the shift's role hears about
// it by email and push. For a harvest that is the whole harvest pool, trained
// or not: the email says training comes first, and new pickers are exactly who
// the coordinator wants to reach.
import { db } from "./db";
import { SHIFT_KIND_LABEL } from "./domain";
import type { ShiftView } from "./roster";
import { queueEmail } from "./emails";
import * as T from "./email-templates";

const calloutRef = (shiftId: string, volunteerId: string) => `callout:${shiftId}:${volunteerId}`;

/** Who a callout for this shift goes to: active volunteers with the role,
 *  except anyone already on it. */
export async function calloutRecipients(view: ShiftView) {
  const onIt = new Set(view.confirmed.map((a) => a.volunteerId));
  const volunteers = await db.volunteer.findMany({
    where: { status: "ACTIVE", role: "VOLUNTEER", roles: { contains: view.kind } },
    orderBy: { firstName: "asc" },
  });
  return volunteers.filter((v) => !onIt.has(v.id));
}

/** Sends the callout once per volunteer per shift. Returns how many were told. */
export async function sendShiftCallout(view: ShiftView): Promise<number> {
  const recipients = await calloutRecipients(view);
  const already = new Set(
    (await db.email.findMany({ where: { ref: { startsWith: `callout:${view.shift.id}:` } }, select: { ref: true } })).map((e) => e.ref),
  );
  let sent = 0;
  for (const v of recipients) {
    const ref = calloutRef(view.shift.id, v.id);
    if (already.has(ref)) continue;
    const p = {
      firstName: v.firstName,
      kindLabel: SHIFT_KIND_LABEL[view.kind],
      harvest: view.kind === "HARVEST",
      name: view.name,
      dateISO: view.iso,
      start: view.shift.startTime,
      end: view.shift.endTime,
      location: view.location,
      notes: view.shift.notes,
      spotsLeft: view.spotsLeft,
      shiftId: view.shift.id,
    };
    await queueEmail(v, T.shiftCallout(p), ref);
    await queueEmail(v, T.shiftCalloutPush(p), ref);
    sent++;
  }
  return sent;
}
