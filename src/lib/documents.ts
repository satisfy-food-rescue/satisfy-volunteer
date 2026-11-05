// Policies and agreements as a volunteer sees them. Shared by the web pages
// and the native app's API so both say the same.
import type { Document, Volunteer } from "@/generated/prisma/client";
import { db } from "./db";

export type VolunteerDocument = {
  document: Document;
  /** The latest version they signed or confirmed reading, and when. */
  readVersion: number | null;
  readAt: Date | null;
  /** A policy with a version they have not confirmed, or an agreement they
   *  need to sign (again). */
  needsAction: boolean;
};

/** A document is for everyone when it names no roles. */
export function documentIsFor(doc: Pick<Document, "roles">, roles: readonly string[]): boolean {
  return doc.roles.length === 0 || doc.roles.some((r) => roles.includes(r));
}

/** The policies and agreements in force that are for this volunteer, in
 *  display order: agreements first. */
export async function documentsFor(me: Pick<Volunteer, "id" | "roles">): Promise<VolunteerDocument[]> {
  const docs = await db.document.findMany({
    where: { archived: false },
    include: { acknowledgements: { where: { volunteerId: me.id }, orderBy: { version: "desc" }, take: 1 } },
    orderBy: [{ kind: "asc" }, { order: "asc" }, { createdAt: "asc" }],
  });
  return docs
    .filter((d) => documentIsFor(d, me.roles))
    .map(({ acknowledgements, ...document }) => {
      const read = acknowledgements[0] ?? null;
      return { document, readVersion: read?.version ?? null, readAt: read?.createdAt ?? null, needsAction: (read?.version ?? 0) < document.version };
    });
}
