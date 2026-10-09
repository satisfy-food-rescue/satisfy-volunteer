import { db } from "./db";
import type { EmailDraft } from "./email-templates";
import { fullName } from "./domain";
import { queuePush } from "./push";

export type Recipient = { id: string; firstName: string; lastName?: string | null; email: string };

/** Records an email or push notification in the Outbox. Emails are not sent;
 *  pushes also go to the volunteer's devices registered in the native app.
 *  A null recipient means the coordinator. */
export async function queueEmail(to: Recipient | null, draft: EmailDraft, ref?: string) {
  const coordinator = to ?? (await db.volunteer.findFirst({ where: { role: "ADMIN" } }));
  if (!coordinator) return null;
  const email = await db.email.create({
    data: {
      volunteerId: to?.id ?? null,
      channel: draft.channel ?? "EMAIL",
      toName: fullName(coordinator),
      toEmail: coordinator.email,
      kind: draft.kind,
      subject: draft.subject,
      preview: draft.preview,
      body: draft.body,
      ctaLabel: draft.ctaLabel ?? null,
      ctaHref: draft.ctaHref ?? null,
      ref: ref ?? null,
    },
  });
  if (to && draft.channel === "PUSH") {
    queuePush(to.id, { title: draft.subject, body: draft.preview, data: { url: draft.ctaHref, kind: draft.kind } });
  }
  return email;
}
