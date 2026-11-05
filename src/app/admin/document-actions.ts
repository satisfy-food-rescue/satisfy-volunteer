"use server";

// Thin wrappers: the rules live in src/lib/document-admin.ts.
import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { requireAdmin } from "@/lib/session";
import * as D from "@/lib/document-admin";
import type { ActionResult } from "@/lib/volunteer-actions";

async function run(action: () => Promise<ActionResult>): Promise<ActionResult> {
  await requireAdmin();
  const r = await action();
  if (r.ok) {
    revalidatePath("/app", "layout");
    revalidatePath("/admin", "layout");
  }
  return r;
}

export async function saveDocument(input: D.DocumentInput): Promise<ActionResult> {
  return run(() => D.saveDocument(input));
}

export async function publishDocumentVersion(input: z.infer<typeof D.publishSchema>): Promise<ActionResult> {
  return run(() => D.publishVersion(input));
}

export async function setDocumentArchived(id: string, archived: boolean): Promise<ActionResult> {
  return run(() => D.setDocumentArchived(id, archived));
}
