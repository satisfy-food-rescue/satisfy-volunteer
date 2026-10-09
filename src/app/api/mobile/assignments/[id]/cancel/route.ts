import { mobileHandler, mutation } from "@/lib/mobile-auth";
import { cancelBooking } from "@/lib/volunteer-actions";

export const dynamic = "force-dynamic";

export const POST = mobileHandler<{ id: string }>(async (me, _request, { params }) => mutation(await cancelBooking(me, (await params).id)));
