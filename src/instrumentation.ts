// Runs once per server start, before any request is handled.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Skipped during `next build`, which loads this file with no database.
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const { env } = await import("@/lib/env");
  // Fail fast on bad configuration rather than on the first request.
  env();
  const { bootstrap } = await import("@/lib/bootstrap");
  await bootstrap();
}
