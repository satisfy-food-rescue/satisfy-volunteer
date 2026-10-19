import { generateKeyPairSync } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";
import { E2E_DATABASE_URL } from "./tests/e2e/support/database-url";

// End-to-end tests run against the production build (the standalone server
// `pnpm start` runs, as in the Docker image) on its own
// port and database, with real sign-in. Every run starts from a freshly
// migrated database filled with the demo data (tests/e2e/support/prepare-db.ts).
// Locally the app is built first; CI builds in an earlier step and sets
// E2E_SKIP_BUILD.

const PORT = 3200;

// Sign in with Apple is configured with a throwaway key, so the button shows
// and the round trip can be followed up to Apple, which the tests stand in
// for (tests/e2e/apple.spec.ts).
const APPLE_TEST_KEY = generateKeyPairSync("ec", { namedCurve: "P-256" }).privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  // Specs share one database and change it as they go.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  // Signing in and setting a password run bcrypt at the production cost,
  // which can take several seconds on a busy machine.
  expect: { timeout: 15_000 },
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: [
      "pnpm exec tsx tests/e2e/support/prepare-db.ts",
      process.env.E2E_SKIP_BUILD ? null : "pnpm build",
      "pnpm start",
    ].filter(Boolean).join(" && "),
    url: `${BASE_URL}/api/health`,
    // Never reuse a running server: every run needs the fresh database.
    reuseExistingServer: false,
    timeout: 240_000,
    env: {
      PORT: String(PORT),
      NODE_ENV: "production",
      DATABASE_URL: E2E_DATABASE_URL,
      APP_URL: BASE_URL,
      EMAIL_DELIVERY: "log",
      CRON_SECRET: "e2e-cron-secret",
      DEMO_MODE: "",
      APPLE_TEAM_ID: "E2ETEAM001",
      APPLE_SERVICES_ID: "nz.org.satisfyfoodrescue.volunteers.e2e",
      APPLE_KEY_ID: "E2EKEY0001",
      APPLE_PRIVATE_KEY: APPLE_TEST_KEY,
    },
  },
});
