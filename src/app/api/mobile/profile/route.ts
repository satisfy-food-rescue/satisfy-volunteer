import { mobileHandler, mutation, readBody } from "@/lib/mobile-auth";
import { profileSchema, updateProfile } from "@/lib/volunteer-actions";

export const dynamic = "force-dynamic";

export const PATCH = mobileHandler(async (me, request) => mutation(await updateProfile(me, await readBody(request, profileSchema))));
