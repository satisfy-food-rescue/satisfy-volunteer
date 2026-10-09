import { z } from "zod";
import type { MutationOk } from "@satisfy/core/api";
import { db } from "@/lib/db";
import { isExpoPushToken } from "@/lib/expo-push";
import { json, mobileHandler, readBody } from "@/lib/mobile-auth";

export const dynamic = "force-dynamic";

const schema = z.object({
  token: z.string().refine(isExpoPushToken),
  platform: z.enum(["ios", "android"]),
  deviceName: z.string().trim().max(100).optional(),
});

/** Registers this device. A token identifies one device, so it moves to
 *  whoever signed in on it last. */
export const POST = mobileHandler(async (me, request) => {
  const { token, platform, deviceName } = await readBody(request, schema);
  const data = { volunteerId: me.id, platform, deviceName: deviceName || null };
  await db.pushToken.upsert({ where: { token }, create: { token, ...data }, update: data });
  return json<MutationOk>({ message: "Notifications are on for this device." });
});

/** Forgets this device, for the signed-in volunteer only. */
export const DELETE = mobileHandler(async (me, request) => {
  const { token } = await readBody(request, z.object({ token: z.string() }));
  await db.pushToken.deleteMany({ where: { token, volunteerId: me.id } });
  return json<MutationOk>({ message: "Notifications are off for this device." });
});
