"use server";

// Thin wrappers: the rules live in src/lib/induction-admin.ts.
import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { requireAdmin } from "@/lib/session";
import * as I from "@/lib/induction-admin";
import type { ActionResult } from "@/lib/volunteer-actions";

function revalidateAll() {
  revalidatePath("/app", "layout");
  revalidatePath("/admin", "layout");
}

async function run(action: () => Promise<ActionResult>): Promise<ActionResult> {
  const r = await action();
  if (r.ok) revalidateAll();
  return r;
}

export async function recordMojCheck(input: z.infer<typeof I.mojCheckSchema>): Promise<ActionResult> {
  const admin = await requireAdmin();
  return run(() => I.recordMojCheck(admin, input));
}

export async function removeMojCheck(checkId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  return run(() => I.removeMojCheck(admin, checkId));
}

export async function saveMojRoles(input: z.infer<typeof I.mojRolesSchema>): Promise<ActionResult> {
  await requireAdmin();
  return run(() => I.saveMojRoles(input));
}
