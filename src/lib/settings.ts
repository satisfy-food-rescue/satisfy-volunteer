import { db } from "./db";

/** The coordinators' settings (one row), or the defaults before anyone has
 *  saved any. */
export async function getSettings() {
  return (await db.settings.findUnique({ where: { id: 1 } })) ?? { id: 1, mojCheckRoles: [], updatedAt: new Date(0) };
}
