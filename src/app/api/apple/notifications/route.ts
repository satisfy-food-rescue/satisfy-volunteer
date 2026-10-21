import { z } from "zod";
import { APPLE, readAppleNotification } from "@/lib/apple";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Apple's server-to-server notifications for Sign in with Apple (set as the
 *  endpoint on the App ID; see DEPLOY.md). Someone who stops using Apple with
 *  Satisfy, or deletes their Apple Account, is disconnected; a relay address
 *  turned off or on is noted. The payload is a JWT signed by Apple. */
export async function POST(request: Request) {
  const body = z.object({ payload: z.string().min(1).max(16_000) }).safeParse(await request.json().catch(() => null));
  if (!body.success) return new Response("Bad request", { status: 400 });
  const event = await readAppleNotification(body.data.payload).catch(() => undefined);
  if (event === undefined) return new Response("Unauthorized", { status: 401 });
  if (event) {
    const where = { provider: APPLE, providerAccountId: event.sub };
    if (event.type === "consent-revoked" || event.type === "account-delete") {
      await db.oAuthAccount.deleteMany({ where });
    } else if (event.email) {
      await db.oAuthAccount.updateMany({ where, data: { email: event.email } });
    }
    console.info("[apple] notification", event.type);
  }
  return new Response(null, { status: 200 });
}
