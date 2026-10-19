"use server";

import { revalidatePath } from "next/cache";
import type { SignUpInput } from "@satisfy/core/api";
import { submitSignUp, type SignUpResult } from "@/lib/applications";
import { clientIp } from "@/lib/rate-limit";

/** The sign-up form. The rules are in src/lib/applications.ts, shared with
 *  the native app. `website` is a field people never see: bots that fill in
 *  every field are told it worked and nothing is recorded. */
export async function signUp(input: SignUpInput & { website?: string }): Promise<SignUpResult> {
  const { website, ...rest } = input;
  if (website) return { ok: true, message: "Thanks. We have your application and will be in touch soon." };
  const result = await submitSignUp(rest, "WEBSITE", await clientIp());
  if (result.ok) revalidatePath("/admin", "layout");
  return result;
}
