// `pnpm db:seed` (and `prisma db seed`): replaces the local database with the
// demo data. Run through tsx with the react-server condition so the app's
// server-only modules can be imported outside Next.js.
//
// It refuses to run with NODE_ENV=production unless DEMO_MODE is set, so it
// cannot wipe real data. Production gets its starting configuration from
// src/lib/bootstrap.ts instead.
import "dotenv/config";
import { seedDemo } from "../src/lib/demo/seed";
import { db } from "../src/lib/db";

seedDemo()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
