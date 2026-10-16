// Liveness probe for the Docker HEALTHCHECK. Deliberately does not touch the
// database: a Postgres blip should not make Coolify restart a healthy server.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ status: "ok" });
}
