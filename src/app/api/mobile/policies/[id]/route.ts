import type { DocumentItem } from "@satisfy/core/api";
import { failure, json, mobileHandler } from "@/lib/mobile-auth";
import { documentsFor } from "@/lib/documents";
import { documentItem } from "@/lib/mobile-api/documents";

export const dynamic = "force-dynamic";

export const GET = mobileHandler<{ id: string }>(async (me, _request, { params }) => {
  const { id } = await params;
  const found = (await documentsFor(me)).find((d) => d.document.id === id);
  return found ? json<DocumentItem>(documentItem(found)) : failure(404, "That policy is no longer available.");
});
