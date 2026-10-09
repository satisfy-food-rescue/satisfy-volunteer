import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests: pure logic in src/lib, no database or server. `pnpm test`.
// Some modules import the Prisma client; it never connects, but point it at an
// in-memory database so a stray query can never touch a real file.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { include: ["tests/unit/**/*.test.ts"], environment: "node", env: { DATABASE_URL: "file::memory:" } },
});
