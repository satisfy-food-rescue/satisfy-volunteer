"use server";

// Thin wrappers: the rules live in src/lib/volunteer-actions.ts, shared with
// the native app's API.
import { redirect } from "next/navigation";
import { destroySession, requireVolunteer } from "@/lib/session";
import * as A from "@/lib/volunteer-actions";
import type { ActionResult } from "@/lib/volunteer-actions";
import type { z } from "zod";

export async function bookShift(shiftId: string): Promise<ActionResult> {
  return A.bookShift(await requireVolunteer(), shiftId);
}

export async function cancelBooking(assignmentId: string): Promise<ActionResult> {
  return A.cancelBooking(await requireVolunteer(), assignmentId);
}

export async function markAway(input: z.infer<typeof A.awaySchema>): Promise<ActionResult> {
  return A.markAway(await requireVolunteer(), input);
}

export async function removeAbsence(absenceId: string): Promise<ActionResult> {
  return A.removeAbsence(await requireVolunteer(), absenceId);
}

export async function completeOnlineModule(moduleId: string): Promise<ActionResult> {
  return A.completeOnlineModule(await requireVolunteer(), moduleId);
}

export async function rsvpSession(sessionId: string, going: boolean): Promise<ActionResult> {
  return A.rsvpSession(await requireVolunteer(), sessionId, going);
}

export async function setHarvestPool(inPool: boolean): Promise<ActionResult> {
  return A.setHarvestPool(await requireVolunteer(), inPool);
}

export async function updateProfile(input: z.infer<typeof A.profileSchema>): Promise<ActionResult> {
  return A.updateProfile(await requireVolunteer(), input);
}

export async function requestRoleChange(message: string): Promise<ActionResult> {
  return A.requestRoleChange(await requireVolunteer(), message);
}

/** Deletes the signed-in volunteer's account, then sends them to sign-in
 *  with a word of thanks. Their session is already gone from the database;
 *  this clears the cookie. */
export async function deleteMyAccount(): Promise<ActionResult> {
  const r = await A.deleteMyAccount(await requireVolunteer());
  if (!r.ok) return r;
  await destroySession();
  redirect("/sign-in?deleted=1");
}
