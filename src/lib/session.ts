import { cookies } from "next/headers";
import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "./db";

// Demo-only "auth": the persona cookie holds a volunteer id. The real build
// replaces this file with proper sessions; everything else calls
// currentUser() / requireVolunteer() / requireAdmin() and stays unchanged.
export const PERSONA_COOKIE = "sfr_persona";

export const currentUser = cache(async () => {
  const jar = await cookies();
  const id = jar.get(PERSONA_COOKIE)?.value;
  if (!id) return null;
  return db.volunteer.findUnique({ where: { id } });
});

export async function requireVolunteer() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  return user;
}

export async function requireAdmin() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  if (user.role !== "ADMIN") redirect("/app");
  return user;
}
