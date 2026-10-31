import { mobileHandler, mutation } from "@/lib/mobile-auth";
import { deleteMyAccount } from "@/lib/volunteer-actions";

export const dynamic = "force-dynamic";

/** The volunteer deletes their own account. The token that made this
 *  request is gone with it, so the app forgets it rather than signing out. */
export const DELETE = mobileHandler(async (me) => mutation(await deleteMyAccount(me)));
