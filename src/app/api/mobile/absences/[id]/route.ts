import { mobileHandler, mutation } from "@/lib/mobile-auth";
import { removeAbsence } from "@/lib/volunteer-actions";

export const dynamic = "force-dynamic";

export const DELETE = mobileHandler<{ id: string }>(async (me, _request, { params }) => mutation(await removeAbsence(me, (await params).id)));
