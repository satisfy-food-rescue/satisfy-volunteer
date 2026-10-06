import "server-only";
import { db } from "./db";
import { todayISO } from "./dates";
import { isDemo } from "./env";
import { runReminders, runShiftReminders } from "./reminders";
import { runCoverChecks } from "./cover";
import { sweepOutbox } from "./emails";
import { ensureDemoData } from "./demo/seed";

// The scheduled work, run hourly by /api/cron/tick. Every job is idempotent
// (messages carry de-duplication refs), so a missed or repeated tick is
// harmless: the next one catches up.

/** Drops sessions and sign-in links that can no longer be used. */
async function cleanUp(now = new Date()) {
  const dayAgo = new Date(now.getTime() - 86_400_000);
  const [sessions, tokens] = await Promise.all([
    db.session.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.authToken.deleteMany({ where: { OR: [{ expiresAt: { lt: dayAgo } }, { usedAt: { lt: dayAgo } }] } }),
  ]);
  return { sessions: sessions.count, tokens: tokens.count };
}

const JOBS = {
  trainingReminders: () => runReminders(todayISO()),
  shiftReminders: () => runShiftReminders(),
  coverChecks: () => runCoverChecks(),
  outbox: () => sweepOutbox(),
  cleanUp: () => cleanUp(),
} as const;

export type TickResult = { ok: boolean; results: Record<string, unknown> };

// One container runs the app, so an in-process flag is enough to stop two
// overlapping ticks from racing on the same reminders.
let running = false;

export async function runTick(): Promise<TickResult> {
  if (running) return { ok: true, results: { skipped: "a tick is already running" } };
  running = true;
  try {
    if (isDemo()) {
      // The demo sends nothing. It only regenerates its data each new day.
      return { ok: true, results: { demoReseeded: await ensureDemoData() } };
    }
    const results: Record<string, unknown> = {};
    let ok = true;
    for (const [name, job] of Object.entries(JOBS)) {
      try {
        results[name] = await job();
      } catch (err) {
        ok = false;
        console.error(`[tick] ${name} failed`, err);
        results[name] = { error: err instanceof Error ? err.message : String(err) };
      }
    }
    return { ok, results };
  } finally {
    running = false;
  }
}
