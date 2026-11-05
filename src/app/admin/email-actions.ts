"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { templateByKey, wordingProblems, type TextField } from "@/lib/email-templates";

const wordingSchema = z.object({
  key: z.string().min(1),
  subject: z.string(),
  preview: z.string(),
  body: z.string(),
  ctaLabel: z.string(),
});

export type WordingResult = { ok: true; message: string } | { ok: false; error: string; fields?: Partial<Record<TextField, string>> };

/** Saves the coordinator's wording for an automatic message. It is used for
 *  every one sent from now on. */
export async function saveEmailWording(input: z.infer<typeof wordingSchema>): Promise<WordingResult> {
  const admin = await requireAdmin();
  const parsed = wordingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please check the message." };
  const { key, ...text } = parsed.data;
  const spec = templateByKey(key);
  if (!spec) return { ok: false, error: "That message no longer exists." };
  const clean = { subject: text.subject.trim(), preview: text.preview.trim(), body: text.body.trim().replace(/\r\n/g, "\n"), ctaLabel: spec.ctaLabel ? text.ctaLabel.trim() : undefined };
  const fields = wordingProblems(spec, clean);
  if (fields) return { ok: false, error: Object.values(fields)[0]!, fields };
  const same = clean.subject === spec.subject && clean.preview === spec.preview && clean.body === spec.body && (clean.ctaLabel ?? null) === (spec.ctaLabel ?? null);
  if (same) {
    await db.emailTemplate.deleteMany({ where: { key } });
  } else {
    const data = { subject: clean.subject, preview: clean.preview, body: clean.body, ctaLabel: clean.ctaLabel ?? null, updatedById: admin.id };
    await db.emailTemplate.upsert({ where: { key }, create: { key, ...data }, update: data });
  }
  revalidatePath("/admin", "layout");
  return { ok: true, message: same ? "That is the standard wording, so the standard wording is used." : `Saved. Every "${spec.name}" message uses your wording from now on.` };
}

/** Goes back to the standard wording. */
export async function resetEmailWording(key: string): Promise<WordingResult> {
  await requireAdmin();
  const spec = templateByKey(z.string().parse(key));
  if (!spec) return { ok: false, error: "That message no longer exists." };
  await db.emailTemplate.deleteMany({ where: { key } });
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Back to the standard wording." };
}
