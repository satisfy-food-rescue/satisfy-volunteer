// Push notifications to the native app. The Outbox row written by queueEmail
// stays the record of what was sent; this delivers it to the volunteer's
// registered devices. Delivery runs after the response so a slow or failing
// Expo never fails, or slows, the action that triggered it.
import { after } from "next/server";
import { db } from "./db";
import { sendExpoPush, type PushMessage } from "./expo-push";

export async function pushToVolunteer(volunteerId: string, message: PushMessage) {
  const tokens = await db.pushToken.findMany({ where: { volunteerId }, select: { token: true } });
  if (tokens.length === 0) return;
  const { delivered, unregistered } = await sendExpoPush(tokens.map((t) => t.token), message);
  if (unregistered.length) await db.pushToken.deleteMany({ where: { token: { in: unregistered } } });
  if (delivered.length) await db.pushToken.updateMany({ where: { token: { in: delivered } }, data: { lastUsedAt: new Date() } });
}

/** Fire and forget. Inside a request (server action, route handler) it runs
 *  after the response via after(); elsewhere (seed, scripts) it just runs. */
export function queuePush(volunteerId: string, message: PushMessage) {
  const task = () => pushToVolunteer(volunteerId, message).catch((e) => console.error("Push delivery failed", e));
  try {
    after(task);
  } catch {
    void task();
  }
}
