import type { AuthConfig } from "@satisfy/core/api";
import { appOrigin, appleConfigured, googleConfigured, isDemo } from "@/lib/env";
import { apiHandler, json } from "@/lib/mobile-auth";
import { passkeysAvailableFor } from "@/lib/mobile-api/platform";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (request) =>
  json<AuthConfig>({
    demo: isDemo(),
    google: !isDemo() && googleConfigured(),
    apple: !isDemo() && appleConfigured(),
    passkeys: !isDemo() && passkeysAvailableFor(request),
    webUrl: appOrigin(),
  }),
);
