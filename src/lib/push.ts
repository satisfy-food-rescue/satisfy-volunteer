import "server-only";
// Push notifications to the native app. The Outbox row written by queueEmail
// is the record of what was sent; src/lib/emails.ts calls this to deliver it
// to the volunteer's registered phones, after the response, and retries it
// from the hourly job if Expo cannot be reached.
import { db } from "./db";
import { env } from "./env";
import { sendExpoPush, type PushMessage } from "./expo-push";

export type PushResult = {
  /** Phones the volunteer was signed in on when it was sent. */
  devices: number;
  /** Phones Expo accepted the notification for. */
  delivered: number;
  ticketIds: string[];
};

export async function pushToVolunteer(volunteerId: string, message: PushMessage): Promise<PushResult> {
  const tokens = await db.pushToken.findMany({ where: { volunteerId }, select: { token: true } });
  if (tokens.length === 0) return { devices: 0, delivered: 0, ticketIds: [] };
  const { delivered, ticketIds, unregistered } = await sendExpoPush(
    tokens.map((t) => t.token),
    message,
    { accessToken: env().EXPO_ACCESS_TOKEN },
  );
  // Expo says these apps were uninstalled: forget them so the next message
  // falls back to email instead of going nowhere.
  if (unregistered.length) await db.pushToken.deleteMany({ where: { token: { in: unregistered } } });
  if (delivered.length) await db.pushToken.updateMany({ where: { token: { in: delivered } }, data: { lastUsedAt: new Date() } });
  return { devices: tokens.length - unregistered.length, delivered: delivered.length, ticketIds };
}
