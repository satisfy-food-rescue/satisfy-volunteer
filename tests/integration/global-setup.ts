import { execSync } from "node:child_process";
import { Client } from "pg";
import { TEST_DATABASE_URL } from "./database-url";

// Creates the test database if needed and brings it to the latest migration.
export default async function setup() {
  const url = new URL(TEST_DATABASE_URL);
  const name = url.pathname.slice(1);
  const admin = new URL(url);
  admin.pathname = "/postgres";
  const client = new Client({ connectionString: admin.toString() });
  await client.connect();
  const exists = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
  if (exists.rowCount === 0) await client.query(`CREATE DATABASE "${name}"`);
  await client.end();
  execSync("pnpm exec prisma migrate deploy", { stdio: "inherit", env: { ...process.env, DATABASE_URL: url.toString() } });
}
