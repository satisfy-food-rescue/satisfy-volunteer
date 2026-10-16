import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { runTick } from "@/lib/jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorised(req: Request): boolean {
  const secret = env().CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Hourly scheduler entry point (see scripts/cron-tick.mjs). */
export async function POST(req: Request) {
  if (!authorised(req)) return Response.json({ error: "unauthorised" }, { status: 401 });
  const result = await runTick();
  return Response.json(result, { status: result.ok ? 200 : 500 });
}
