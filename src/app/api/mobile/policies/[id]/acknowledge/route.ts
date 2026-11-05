import { mobileHandler, mutation, readBody } from "@/lib/mobile-auth";
import { acknowledgeDocument, acknowledgeSchema } from "@/lib/volunteer-actions";

export const dynamic = "force-dynamic";

export const POST = mobileHandler<{ id: string }>(async (me, request, { params }) => {
  const { version } = await readBody(request, acknowledgeSchema);
  return mutation(await acknowledgeDocument(me, (await params).id, version));
});
