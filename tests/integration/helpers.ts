import { db } from "@/lib/db";
import type { VolunteerRole } from "@/lib/domain";

/** Empties every table, keeping the schema. */
export async function resetDb() {
  const tables = await db.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await db.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
}

let n = 0;
export async function makeVolunteer(over: Partial<{ firstName: string; email: string; roles: VolunteerRole[]; role: "ADMIN" | "VOLUNTEER"; phone: string }> = {}) {
  n++;
  return db.volunteer.create({
    data: { firstName: over.firstName ?? `Vol${n}`, lastName: "Test", email: over.email ?? `vol${n}@example.org`, roles: over.roles ?? ["WAREHOUSE"], role: over.role ?? "VOLUNTEER", phone: over.phone ?? null },
  });
}
