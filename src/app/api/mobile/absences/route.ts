import { mobileHandler, mutation, readBody } from "@/lib/mobile-auth";
import { awaySchema, markAway } from "@/lib/volunteer-actions";

export const dynamic = "force-dynamic";

export const POST = mobileHandler(async (me, request) => mutation(await markAway(me, await readBody(request, awaySchema))));
