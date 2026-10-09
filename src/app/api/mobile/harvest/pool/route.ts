import { mobileHandler, mutation, readBody } from "@/lib/mobile-auth";
import { harvestPoolSchema, setHarvestPool } from "@/lib/volunteer-actions";

export const dynamic = "force-dynamic";

export const PUT = mobileHandler(async (me, request) => mutation(await setHarvestPool(me, (await readBody(request, harvestPoolSchema)).inPool)));
