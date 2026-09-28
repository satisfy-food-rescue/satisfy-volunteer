"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { PERSONA_COOKIE } from "@/lib/session";

export async function signInAs(formData: FormData) {
  const key = String(formData.get("persona") ?? "");
  const volunteer = await db.volunteer.findUnique({ where: { personaKey: key } });
  if (!volunteer) redirect("/sign-in");
  const jar = await cookies();
  jar.set(PERSONA_COOKIE, volunteer.id, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });
  redirect(volunteer.role === "ADMIN" ? "/admin" : "/app");
}

export async function signOut() {
  const jar = await cookies();
  jar.delete(PERSONA_COOKIE);
  redirect("/sign-in");
}
