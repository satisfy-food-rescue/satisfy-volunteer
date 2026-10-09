import type { DemoPersonas } from "@satisfy/core/api";
import { db } from "@/lib/db";
import { isDemo } from "@/lib/demo";
import { apiHandler, failure, json } from "@/lib/mobile-auth";
import { PERSONAS } from "@/lib/personas";

export const dynamic = "force-dynamic";

// The coordinator persona is web-only, so only volunteers are listed.
export const GET = apiHandler(async () => {
  if (!isDemo()) return failure(404, "Not found.");
  const people = await db.volunteer.findMany({ where: { personaKey: { in: PERSONAS.map((p) => p.key) }, role: "VOLUNTEER", status: "ACTIVE" } });
  const byKey = new Map(people.map((p) => [p.personaKey, p]));
  return json<DemoPersonas>({
    personas: PERSONAS.flatMap((p) => {
      const v = byKey.get(p.key);
      return v ? [{ key: p.key, firstName: v.firstName, lastName: v.lastName, label: p.label, blurb: p.blurb }] : [];
    }),
  });
});
