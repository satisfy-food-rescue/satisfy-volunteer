// Loads induction (the Ministry of Justice check and agreements) for the
// rules in induction.ts.
import type { Volunteer } from "@/generated/prisma/client";
import { db } from "./db";
import { todayISO } from "./dates";
import { inductionStatus, type Induction } from "./induction";
import { getSettings } from "./settings";

/** The agreements in force, in display order. */
export function currentAgreements() {
  return db.document.findMany({ where: { kind: "AGREEMENT", archived: false }, orderBy: [{ order: "asc" }, { createdAt: "asc" }] });
}

export async function inductionFor(volunteer: Pick<Volunteer, "id" | "roles">, today = todayISO()): Promise<Induction> {
  const [settings, checks, agreements, acknowledgements] = await Promise.all([
    getSettings(),
    db.mojCheck.findMany({ where: { volunteerId: volunteer.id }, select: { checkedOn: true } }),
    currentAgreements(),
    db.documentAcknowledgement.findMany({ where: { volunteerId: volunteer.id, document: { kind: "AGREEMENT" } } }),
  ]);
  return inductionStatus(volunteer, { mojCheckRoles: settings.mojCheckRoles, checks, agreements, acknowledgements }, today);
}

/** Induction for many volunteers at once, for the admin lists. */
export async function inductionsFor(volunteers: readonly Pick<Volunteer, "id" | "roles">[], today = todayISO()): Promise<Map<string, Induction>> {
  const ids = volunteers.map((v) => v.id);
  const [settings, checks, agreements, acknowledgements] = await Promise.all([
    getSettings(),
    db.mojCheck.findMany({ where: { volunteerId: { in: ids } }, select: { volunteerId: true, checkedOn: true } }),
    currentAgreements(),
    db.documentAcknowledgement.findMany({ where: { volunteerId: { in: ids }, document: { kind: "AGREEMENT" } } }),
  ]);
  return new Map(
    volunteers.map((v) => [
      v.id,
      inductionStatus(
        v,
        { mojCheckRoles: settings.mojCheckRoles, checks: checks.filter((c) => c.volunteerId === v.id), agreements, acknowledgements: acknowledgements.filter((a) => a.volunteerId === v.id) },
        today,
      ),
    ]),
  );
}
