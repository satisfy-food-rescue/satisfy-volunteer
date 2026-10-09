// Expo push delivery over plain HTTP, no SDK. Pure apart from `fetch`, so the
// chunking and ticket handling are unit-tested (tests/unit/expo-push.test.ts).
// Database work lives in src/lib/push.ts.
import type { PushData } from "@satisfy/core/api";

export const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
/** Expo accepts at most 100 messages per request. */
export const EXPO_CHUNK_SIZE = 100;

export type PushMessage = { title: string; body: string; data: PushData };

type Ticket = { status: "ok"; id: string } | { status: "error"; message?: string; details?: { error?: string } };

export function isExpoPushToken(token: string): boolean {
  return /^Expo(nent)?PushToken\[[^\]\s]+\]$/.test(token);
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Sends one message to every token. Never throws: request and ticket errors
 *  are logged. Returns the tokens Expo accepted and the ones it says belong
 *  to uninstalled apps, which the caller should forget. */
export async function sendExpoPush(
  tokens: readonly string[],
  message: PushMessage,
  { fetch: fetchImpl = fetch, accessToken = process.env.EXPO_ACCESS_TOKEN }: { fetch?: typeof fetch; accessToken?: string } = {},
): Promise<{ delivered: string[]; unregistered: string[] }> {
  const delivered: string[] = [];
  const unregistered: string[] = [];
  const headers: Record<string, string> = { accept: "application/json", "content-type": "application/json" };
  if (accessToken) headers.authorization = `Bearer ${accessToken}`;
  for (const batch of chunk(tokens, EXPO_CHUNK_SIZE)) {
    try {
      const res = await fetchImpl(EXPO_PUSH_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(batch.map((to) => ({ to, title: message.title, body: message.body, sound: "default", data: message.data }))),
      });
      const json = (await res.json().catch(() => null)) as { data?: Ticket[]; errors?: unknown } | null;
      if (!res.ok || !Array.isArray(json?.data)) {
        console.error(`Expo push failed (${res.status})`, json?.errors ?? json);
        continue;
      }
      // Tickets come back in the order the messages were sent.
      json.data.forEach((ticket, i) => {
        const token = batch[i];
        if (!token) return;
        if (ticket.status === "ok") delivered.push(token);
        else if (ticket.details?.error === "DeviceNotRegistered") unregistered.push(token);
        else console.error(`Expo push ticket error for ${token}: ${ticket.message ?? ticket.details?.error ?? "unknown"}`);
      });
    } catch (e) {
      console.error("Expo push request failed", e);
    }
  }
  return { delivered, unregistered };
}
