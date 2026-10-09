import { mobileHandler, mutation, readBody } from "@/lib/mobile-auth";
import { rsvpSchema, rsvpSession } from "@/lib/volunteer-actions";

export const dynamic = "force-dynamic";

export const POST = mobileHandler<{ id: string }>(async (me, request, { params }) => {
  const { going } = await readBody(request, rsvpSchema);
  return mutation(await rsvpSession(me, (await params).id, going));
});
