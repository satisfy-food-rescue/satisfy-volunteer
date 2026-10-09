import { z } from "zod";
import type { MutationOk } from "@satisfy/core/api";
import { db } from "@/lib/db";
import { endMobileSession, json, mobileHandler, readBody } from "@/lib/mobile-auth";

export const dynamic = "force-dynamic";

const schema = z.object({ pushToken: z.string().optional() });

/** Signs this device out and, when given, forgets its push token. */
export const DELETE = mobileHandler(async (me, request) => {
  const { pushToken } = await readBody(request, schema);
  if (pushToken) await db.pushToken.deleteMany({ where: { token: pushToken, volunteerId: me.id } });
  await endMobileSession(request);
  return json<MutationOk>({ message: "Signed out." });
});
