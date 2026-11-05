import { mobileHandler, mutation, readBody } from "@/lib/mobile-auth";
import { signAgreements, signAgreementsSchema } from "@/lib/volunteer-actions";

export const dynamic = "force-dynamic";

export const POST = mobileHandler(async (me, request) => mutation(await signAgreements(me, await readBody(request, signAgreementsSchema))));
