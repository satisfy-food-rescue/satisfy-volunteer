import { redirect } from "next/navigation";
import { appOrigin } from "@/lib/env";
import { oauthCallbackDestination } from "@/lib/oauth-callback";

export const dynamic = "force-dynamic";

/** Apple answers with a cross-site form POST, which carries no SameSite=Lax
 *  cookies: neither the round trip's nor the session's. So it is turned into
 *  a GET to this same address (a 303), a top-level navigation that does carry
 *  them. Only the code, state and error go along: the name and email Apple
 *  may post are not used, since the ID token has the email. */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const url = new URL("/auth/apple/callback", appOrigin());
  for (const field of ["code", "state", "error"]) {
    const value = form?.get(field);
    if (typeof value === "string" && value) url.searchParams.set(field, value);
  }
  return Response.redirect(url, 303);
}

/** See src/lib/oauth-callback.ts. */
export async function GET(req: Request) {
  redirect(await oauthCallbackDestination("apple", new URL(req.url).searchParams));
}
