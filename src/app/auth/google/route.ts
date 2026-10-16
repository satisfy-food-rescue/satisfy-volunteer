import { redirect } from "next/navigation";
import { googleConfigured } from "@/lib/env";
import { safeNextPath } from "@/lib/auth-shared";
import { AppChallenge, startGoogleSignIn } from "@/lib/oauth";
import { appRedirect } from "@/lib/mobile-auth";

export const dynamic = "force-dynamic";

/** "Continue with Google" on the sign-in page, "Connect Google" in security
 *  settings, and the native app (opened in the system browser with
 *  ?app=<PKCE challenge>) all start here. */
export async function GET(req: Request) {
  const search = new URL(req.url).searchParams;
  const app = search.get("app");
  if (app !== null) {
    const challenge = AppChallenge.safeParse(app);
    if (!challenge.success || !googleConfigured()) redirect(appRedirect({ error: challenge.success ? "google_unavailable" : "google_failed" }));
    redirect((await startGoogleSignIn(null, challenge.data)).toString());
  }
  if (!googleConfigured()) redirect("/sign-in?error=google_unavailable");
  const url = await startGoogleSignIn(safeNextPath(search.get("next")), null);
  redirect(url.toString());
}
