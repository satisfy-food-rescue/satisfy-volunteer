import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Two projects:
//  - unit: pure logic in src/lib, no database. `pnpm test`.
//  - integration: jobs, outbox and sign-in links against a real Postgres
//    (TEST_DATABASE_URL, by default a `satisfy_test` database on the docker
//    compose server). `pnpm test:integration`. Files run one at a time
//    because they share the database.

// The integration test database. Defaults to a `satisfy_test` database on the
// docker compose Postgres; CI points TEST_DATABASE_URL at its service. Set
// here so the global setup (tests/integration/global-setup.ts) sees it too.
const TEST_DATABASE_URL = (process.env.TEST_DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5435/satisfy_test");

const shared = {
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // server-only throws outside a React Server Components build.
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
};

export default defineConfig({
  test: {
    projects: [
      {
        ...shared,
        test: { name: "unit", include: ["tests/unit/**/*.test.ts?(x)"], environment: "node", env: { APP_URL: "https://volunteers.example.org", DATABASE_URL: "postgresql://unused" } },
      },
      {
        ...shared,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          fileParallelism: false,
          globalSetup: ["tests/integration/global-setup.ts"],
          env: { DATABASE_URL: TEST_DATABASE_URL, APP_URL: "https://volunteers.example.org", COORDINATOR_EMAIL: "coordinator@example.org" },
          testTimeout: 20_000,
        },
      },
    ],
  },
});
