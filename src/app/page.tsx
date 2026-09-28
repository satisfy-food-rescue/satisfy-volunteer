import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  redirect(user.role === "ADMIN" ? "/admin" : "/app");
}
