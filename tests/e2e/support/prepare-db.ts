import { execSync } from "node:child_process";
import { Client } from "pg";
import { E2E_DATABASE_URL } from "./database-url";

// Fresh demo data for every run: recreate the database, migrate, seed. Run
// by the Playwright web server command, before the app starts, because
// Playwright starts the web server ahead of any global setup.
async function prepare() {
  const url = new URL(E2E_DATABASE_URL);
  const name = url.pathname.slice(1);
  const admin = new URL(url);
  admin.pathname = "/postgres";
  const client = new Client({ connectionString: admin.toString() });
  await client.connect();
  await client.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  await client.query(`CREATE DATABASE "${name}"`);
  await client.end();
  const env: NodeJS.ProcessEnv = { ...process.env, DATABASE_URL: url.toString(), NODE_ENV: "development", DEMO_MODE: "" };
  execSync("pnpm exec prisma migrate deploy", { stdio: "inherit", env });
  execSync("pnpm db:seed", { stdio: "inherit", env });
}

prepare().catch((err) => {
  console.error(err);
  process.exit(1);
});
