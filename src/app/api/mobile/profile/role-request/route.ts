import { mobileHandler, mutation, readBody } from "@/lib/mobile-auth";
import { requestRoleChange, roleRequestSchema } from "@/lib/volunteer-actions";

export const dynamic = "force-dynamic";

export const POST = mobileHandler(async (me, request) => mutation(await requestRoleChange(me, (await readBody(request, roleRequestSchema)).message)));
