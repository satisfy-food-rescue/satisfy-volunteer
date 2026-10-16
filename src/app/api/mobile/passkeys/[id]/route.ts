import type { MutationOk } from "@satisfy/core/api";
import { db } from "@/lib/db";
import { failure, json, mobileHandler } from "@/lib/mobile-auth";

export const dynamic = "force-dynamic";

export const DELETE = mobileHandler<{ id: string }>(async (me, _request, { params }) => {
  const { id } = await params;
  const { count } = await db.passkey.deleteMany({ where: { id, volunteerId: me.id } });
  if (count === 0) return failure(404, "That passkey has already been removed.");
  return json<MutationOk>({ message: "Passkey removed. You may also want to delete it from your phone's passwords." });
});
