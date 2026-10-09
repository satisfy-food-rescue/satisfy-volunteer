// Expo writes the typed-route declarations (.expo/types/router.d.ts) only
// while its dev server runs. CI runs it just long enough to write them, so
// `tsc` checks every href against the real routes.
//   node scripts/generate-route-types.mjs
import { spawn } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const declarations = `${root}.expo/types/router.d.ts`;
rmSync(declarations, { force: true });

const server = spawn("npx", ["expo", "start", "--port", "8099"], { cwd: root, env: { ...process.env, CI: "1" }, stdio: "ignore", detached: true });
const stop = () => {
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {}
};

const deadline = Date.now() + 120_000;
while (!existsSync(declarations)) {
  if (Date.now() > deadline || server.exitCode !== null) {
    stop();
    console.error("Expo did not generate route types within two minutes.");
    process.exit(1);
  }
  await sleep(500);
}
// Give Expo a moment to finish writing expo-env.d.ts alongside.
await sleep(1000);
stop();
console.log("Generated .expo/types/router.d.ts");
