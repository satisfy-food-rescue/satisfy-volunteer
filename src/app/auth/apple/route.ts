import { redirect } from "next/navigation";
import { appleConfigured } from "@/lib/env";
import { safeNextPath } from "@/lib/auth-shared";
import { startAppleSignIn } from "@/lib/apple";
import { AppChallenge } from "@/lib/oauth";
import { appRedirect } from "@/lib/mobile-auth";

export const dynamic = "force-dynamic";

/** "Continue with Apple" on the sign-in page, "Connect Apple" in security
 *  settings, and the Android app (opened in the system browser with
 *  ?app=<PKCE challenge>) all start here. The iOS app signs in natively. */
export async function GET(req: Request) {
  const search = new URL(req.url).searchParams;
  const app = search.get("app");
  if (app !== null) {
    const challenge = AppChallenge.safeParse(app);
    if (!challenge.success || !appleConfigured()) redirect(appRedirect({ error: challenge.success ? "apple_unavailable" : "apple_failed" }));
    redirect((await startAppleSignIn(null, challenge.data)).toString());
  }
  if (!appleConfigured()) redirect("/sign-in?error=apple_unavailable");
  redirect((await startAppleSignIn(safeNextPath(search.get("next")), null)).toString());
}
