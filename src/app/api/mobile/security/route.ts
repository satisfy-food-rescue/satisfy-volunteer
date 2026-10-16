import type { SecurityOverview } from "@satisfy/core/api";
import { db } from "@/lib/db";
import { formatInstant } from "@/lib/dates";
import { absoluteUrl } from "@/lib/env";
import { json, mobileHandler } from "@/lib/mobile-auth";
import { passkeysAvailableFor } from "@/lib/mobile-api/platform";
import { GOOGLE } from "@/lib/oauth";

export const dynamic = "force-dynamic";

export const GET = mobileHandler(async (me, request) => {
  const [passkeys, google] = await Promise.all([
    db.passkey.findMany({ where: { volunteerId: me.id }, orderBy: { createdAt: "asc" } }),
    db.oAuthAccount.findFirst({ where: { volunteerId: me.id, provider: GOOGLE } }),
  ]);
  return json<SecurityOverview>({
    hasPassword: me.passwordHash !== null,
    google: google ? { email: google.email } : null,
    passkeys: passkeys.map((p) => ({ id: p.id, name: p.name, addedLabel: formatInstant(p.createdAt), lastUsedLabel: p.lastUsedAt ? formatInstant(p.lastUsedAt) : null })),
    passkeysAvailable: passkeysAvailableFor(request),
    manageUrl: absoluteUrl(me.role === "ADMIN" ? "/admin/security" : "/app/security"),
  });
});
