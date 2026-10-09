import { mobileHandler, mutation } from "@/lib/mobile-auth";
import { completeOnlineModule } from "@/lib/volunteer-actions";

export const dynamic = "force-dynamic";

/** The segment is the module id (see ../route.ts). */
export const POST = mobileHandler<{ module: string }>(async (me, _request, { params }) => mutation(await completeOnlineModule(me, (await params).module)));
