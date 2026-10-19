import { revalidatePath } from "next/cache";
import type { ApiFailure, MutationOk } from "@satisfy/core/api";
import { submitSignUp } from "@/lib/applications";
import { apiHandler, json } from "@/lib/mobile-auth";
import { clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** "Sign up to volunteer" in the app. Same rules and reply as /sign-up on the
 *  website (src/lib/applications.ts): an application for the coordinator, not
 *  an account. */
export const POST = apiHandler(async (request) => {
  const result = await submitSignUp(await request.json().catch(() => null), "APP", await clientIp());
  if (!result.ok) return json<ApiFailure>({ error: result.error, ...(result.fields && { fields: result.fields }) }, result.status);
  revalidatePath("/admin", "layout");
  return json<MutationOk>({ message: result.message });
});
