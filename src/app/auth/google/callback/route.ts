import { redirect } from "next/navigation";
import { oauthCallbackDestination } from "@/lib/oauth-callback";

export const dynamic = "force-dynamic";

/** Google sends the browser back here. See src/lib/oauth-callback.ts. */
export async function GET(req: Request) {
  redirect(await oauthCallbackDestination("google", new URL(req.url).searchParams));
}
