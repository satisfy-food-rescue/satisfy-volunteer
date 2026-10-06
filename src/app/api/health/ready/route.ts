import { db } from "@/lib/db";

// Readiness: can the app reach Postgres? For uptime monitoring and post-deploy
// smoke checks, not the container healthcheck.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok", database: "ok" });
  } catch {
    return Response.json({ status: "error", database: "unreachable" }, { status: 503 });
  }
}
