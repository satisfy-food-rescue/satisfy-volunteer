import { json, mobileHandler } from "@/lib/mobile-auth";
import { mobileSession } from "@/lib/mobile-api/session";
import type { MobileSession } from "@satisfy/core/api";

export const dynamic = "force-dynamic";

export const GET = mobileHandler(async (me) => json<MobileSession>(await mobileSession(me)));
