import "server-only";
// Coordinators add and edit the policies and agreements volunteers see. The
// documents themselves stay in Google Drive, owned by the board; here they
// are linked, described and versioned. Editing changes nothing for
// volunteers: publishing a new version asks them to read it (a policy) or
// sign it again before their next booking (an agreement), and can tell them
// by email and push. The server actions in src/app/admin/document-actions.ts
// check requireAdmin().
import { z } from "zod";
import type { Document } from "@/generated/prisma/client";
import { db } from "./db";
import { VOLUNTEER_ROLES, sortRoles } from "./domain";
import { ACTIVE_POOL } from "./pool";
import { documentIsFor } from "./documents";
import { queueEmail } from "./emails";
import { documentUpdated, documentUpdatedPush } from "./email-templates";
import type { ActionResult } from "./volunteer-actions";

export const documentSchema = z.object({
  /** Null adds a new document. */
  id: z.string().min(1).nullable(),
  kind: z.enum(["AGREEMENT", "POLICY"]),
  title: z.string().trim().min(2, "Add a title.").max(100),
  summary: z.string().trim().min(2, "Add a one-line summary.").max(300),
  url: z.union([z.literal(""), z.url({ protocol: /^https$/, error: "The link must start with https://" }).max(500)]),
  body: z.string().trim().max(10000),
  /** Agreements: who signs. Policies: who it is for; none is everyone. */
  roles: z.array(z.enum(VOLUNTEER_ROLES)),
  /** New documents only: email and push everyone it is for. */
  notify: z.boolean(),
});
export type DocumentInput = z.infer<typeof documentSchema>;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Active volunteers a document is for. */
async function audience(doc: Pick<Document, "roles">) {
  const pool = await db.volunteer.findMany({ where: ACTIVE_POOL, orderBy: { firstName: "asc" } });
  return pool.filter((v) => documentIsFor(doc, v.roles));
}

/** Emails and pushes everyone the current version is for, once each. */
async function notify(doc: Document): Promise<number> {
  const people = await audience(doc);
  const prefix = `document:${doc.id}:${doc.version}:`;
  const sent = new Set((await db.email.findMany({ where: { ref: { startsWith: prefix } }, select: { ref: true } })).map((e) => e.ref));
  let count = 0;
  for (const v of people) {
    const ref = `${prefix}${v.id}`;
    if (sent.has(ref)) continue;
    const p = { firstName: v.firstName, title: doc.title, note: doc.versionNote, agreement: doc.kind === "AGREEMENT", documentId: doc.id };
    await queueEmail(v, documentUpdated(p), ref);
    await queueEmail(v, documentUpdatedPush(p), ref);
    count++;
  }
  return count;
}

export async function saveDocument(input: DocumentInput): Promise<ActionResult> {
  const parsed = documentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the form." };
  const d = parsed.data;
  if (d.kind === "AGREEMENT" && d.roles.length === 0) return { ok: false, error: "Pick the roles that sign it." };
  if (!d.url && !d.body) return { ok: false, error: "Add the Google Drive link, or the words volunteers read." };
  const data = { kind: d.kind, title: d.title, summary: d.summary, url: d.url || null, body: d.body || null, roles: sortRoles(d.roles) };
  if (d.id) {
    const before = await db.document.findUnique({ where: { id: d.id } });
    if (!before) return { ok: false, error: "That document no longer exists.", notFound: true };
    if (before.kind !== d.kind) return { ok: false, error: "A policy cannot become an agreement. Add a new one instead." };
    await db.document.update({ where: { id: d.id }, data });
    return { ok: true, message: "Saved. Publish a new version when volunteers need to read it again." };
  }
  const last = await db.document.findFirst({ where: { kind: d.kind }, orderBy: { order: "desc" }, select: { order: true } });
  const doc = await db.document.create({ data: { ...data, order: (last?.order ?? 0) + 1 } });
  const reach = (await audience(doc)).length;
  const told = d.notify ? await notify(doc) : 0;
  const who = plural(reach, "volunteer", "volunteers");
  return {
    ok: true,
    message:
      d.kind === "AGREEMENT"
        ? `Added. ${who} need to sign it before their next booking${told ? ", and have been emailed" : ""}.`
        : `Added. ${who} can read it${told ? " and have been emailed" : ""}.`,
  };
}

export const publishSchema = z.object({
  id: z.string().min(1),
  /** What changed, shown to volunteers. */
  note: z.string().trim().max(500),
  notify: z.boolean(),
});

/** A new version: everyone it is for reads it again (a policy) or signs it
 *  again before their next booking (an agreement). */
export async function publishVersion(input: z.infer<typeof publishSchema>): Promise<ActionResult> {
  const parsed = publishSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Keep the note under 500 characters." };
  const { id, note, notify: tell } = parsed.data;
  const before = await db.document.findUnique({ where: { id } });
  if (!before || before.archived) return { ok: false, error: "That document is no longer in use.", notFound: true };
  const doc = await db.document.update({ where: { id }, data: { version: { increment: 1 }, versionNote: note || null, versionAt: new Date() } });
  const told = tell ? await notify(doc) : 0;
  const agreement = doc.kind === "AGREEMENT";
  return {
    ok: true,
    message: `Version ${doc.version} published. ${agreement ? "Volunteers sign it again before their next booking" : "Volunteers are asked to read it again"}${told ? `; ${plural(told, "volunteer has", "volunteers have")} been emailed` : ""}.`,
  };
}

/** Archived documents disappear for volunteers and stop being required. The
 *  record of who signed or read them is kept. */
export async function setDocumentArchived(id: string, archived: boolean): Promise<ActionResult> {
  const { count } = await db.document.updateMany({ where: { id }, data: { archived } });
  if (count === 0) return { ok: false, error: "That document no longer exists.", notFound: true };
  return { ok: true, message: archived ? "Archived. Volunteers no longer see it." : "Restored. Volunteers can see it again." };
}
