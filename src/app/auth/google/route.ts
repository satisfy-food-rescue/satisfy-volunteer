import { redirect } from "next/navigation";
import { googleConfigured } from "@/lib/env";
import { safeNextPath } from "@/lib/auth-shared";
import { startGoogleSignIn } from "@/lib/oauth";

export const dynamic = "force-dynamic";

/** "Continue with Google" on the sign-in page and "Connect Google" in
 *  security settings both start here; the callback tells them apart by
 *  whether someone is already signed in. */
export async function GET(req: Request) {
  if (!googleConfigured()) redirect("/sign-in?error=google_unavailable");
  const next = safeNextPath(new URL(req.url).searchParams.get("next"));
  const url = await startGoogleSignIn(next);
  redirect(url.toString());
}
