import { mobileHandler, mutation } from "@/lib/mobile-auth";
import { startTraining } from "@/lib/volunteer-actions";

export const dynamic = "force-dynamic";

export const POST = mobileHandler(async (me) => mutation(await startTraining(me)));
