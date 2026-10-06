import "server-only";
import { db } from "./db";
import { normaliseEmail } from "./domain";
import { env, isDemo } from "./env";
import { createReferenceData } from "./reference-data";
import { ensureDemoData } from "./demo/seed";

// Runs once when the server starts (src/instrumentation.ts), after the
// container has applied migrations. Idempotent.

/** A fresh database gets Satisfy's routes, shift types and training modules
 *  so the app is usable straight away. Never touches an existing set-up. */
async function ensureReferenceData() {
  const configured = (await db.shiftTemplate.count()) + (await db.trainingModule.count());
  if (configured > 0) return;
  await db.$transaction((tx) => createReferenceData(tx));
  console.log("[bootstrap] created the starting routes, shift types and training modules");
}

/** While there is no active admin, makes BOOTSTRAP_ADMIN_EMAIL one, so a new
 *  deployment has someone who can sign in (with Google, or by asking for a
 *  link through "First time here?"). Once any admin exists it does nothing,
 *  so demoting or deactivating that person later sticks across restarts. No
 *  password is ever set here. */
async function ensureBootstrapAdmin() {
  const { BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_NAME } = env();
  if (!BOOTSTRAP_ADMIN_EMAIL) return;
  if (await db.volunteer.count({ where: { role: "ADMIN", status: "ACTIVE" } })) return;
  const email = normaliseEmail(BOOTSTRAP_ADMIN_EMAIL);
  const [firstName, ...rest] = BOOTSTRAP_ADMIN_NAME.trim().split(/\s+/);
  const existing = await db.volunteer.findUnique({ where: { email } });
  await db.volunteer.upsert({
    where: { email },
    update: { role: "ADMIN", status: "ACTIVE" },
    create: { email, firstName: firstName || "Coordinator", lastName: rest.join(" ") || null, role: "ADMIN" },
  });
  console.log(`[bootstrap] ${existing ? "promoted" : "created"} admin ${email}`);
}

export async function bootstrap() {
  if (isDemo()) {
    // A deploy may bring a new seed, so production demo servers always start
    // fresh; in development only a new day regenerates the data.
    await ensureDemoData({ force: env().NODE_ENV === "production" });
    return;
  }
  await ensureReferenceData();
  await ensureBootstrapAdmin();
}
