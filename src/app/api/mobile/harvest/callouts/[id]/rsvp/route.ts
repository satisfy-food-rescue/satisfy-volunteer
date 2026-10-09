import { mobileHandler, mutation, readBody } from "@/lib/mobile-auth";
import { rsvpHarvest, rsvpSchema } from "@/lib/volunteer-actions";

export const dynamic = "force-dynamic";

export const POST = mobileHandler<{ id: string }>(async (me, request, { params }) => {
  const { going } = await readBody(request, rsvpSchema);
  return mutation(await rsvpHarvest(me, (await params).id, going));
});
