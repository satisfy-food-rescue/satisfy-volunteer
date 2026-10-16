// `pnpm start`: runs the production build the way the Docker image does, from
// the standalone bundle, so tests exercise exactly what is deployed. The
// image copies static assets and public/ next to server.js; this does the
// same in place. Settings come from the environment, then .env if present.
import { cpSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";

const standalone = ".next/standalone";
if (!existsSync(`${standalone}/server.js`)) {
  console.error("No standalone build found. Run `pnpm build` first.");
  process.exit(1);
}
cpSync("public", `${standalone}/public`, { recursive: true });
cpSync(".next/static", `${standalone}/.next/static`, { recursive: true });
if (existsSync(".env")) process.loadEnvFile(".env");
await import(pathToFileURL(`${standalone}/server.js`).href);
