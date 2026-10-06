// Calls the app's hourly job endpoint. Run inside the container by a Coolify
// scheduled task (`node scripts/cron-tick.mjs`, every hour), so it talks to
// the server over localhost and reads CRON_SECRET from the same environment.
const port = process.env.PORT || 3000;
const secret = process.env.CRON_SECRET;
if (!secret) {
  console.error("CRON_SECRET is not set");
  process.exit(1);
}
const res = await fetch(`http://127.0.0.1:${port}/api/cron/tick`, {
  method: "POST",
  headers: { authorization: `Bearer ${secret}` },
  signal: AbortSignal.timeout(280_000),
});
console.log(res.status, await res.text());
process.exit(res.ok ? 0 : 1);
