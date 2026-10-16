import "server-only";
import { headers } from "next/headers";

// Sliding-window limiter for sign-in and email-sending endpoints. In memory:
// the app runs as a single container, and a restart resetting the counters is
// acceptable for what this guards (password guessing and email bombing). Move
// to Postgres or Redis if the app is ever scaled out.

const hits = new Map<string, number[]>();
let lastPrune = 0;

function prune(now: number) {
  if (now - lastPrune < 60_000) return;
  lastPrune = now;
  for (const [key, times] of hits) {
    // Windows are at most an hour; anything older can go.
    if (times[times.length - 1] < now - 3_600_000) hits.delete(key);
  }
}

export type Limit = { limit: number; windowMs: number };

/** Records an attempt against `key`. Returns false when over the limit. */
export function take(key: string, { limit, windowMs }: Limit, now = Date.now()): boolean {
  prune(now);
  const recent = (hits.get(key) ?? []).filter((t) => t > now - windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}

/** Forgets a key, e.g. after a successful sign-in. */
export function reset(key: string) {
  hits.delete(key);
}

/** The client address as reported by the reverse proxy (Coolify's Traefik). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

export const LIMITS = {
  /** Failed password attempts per account. */
  passwordPerEmail: { limit: 5, windowMs: 15 * 60_000 },
  /** Failed password attempts per address, across accounts. */
  passwordPerIp: { limit: 30, windowMs: 15 * 60_000 },
  /** Sign-in link emails per address requested. */
  linkPerEmail: { limit: 3, windowMs: 60 * 60_000 },
  linkPerIp: { limit: 10, windowMs: 60 * 60_000 },
} satisfies Record<string, Limit>;
