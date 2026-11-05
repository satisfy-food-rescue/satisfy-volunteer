import type { PolicyList } from "@satisfy/core/api";
import { json, mobileHandler } from "@/lib/mobile-auth";
import { documentsFor } from "@/lib/documents";
import { documentItem } from "@/lib/mobile-api/documents";

export const dynamic = "force-dynamic";

export const GET = mobileHandler(async (me) => json<PolicyList>({ documents: (await documentsFor(me)).map(documentItem) }));
