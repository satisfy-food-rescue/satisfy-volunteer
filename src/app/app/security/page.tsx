import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireVolunteer } from "@/lib/session";
import { securityProps } from "@/lib/security-data";
import { SecuritySettings } from "@/components/auth/security-settings";

export const metadata = { title: "Sign-in and security" };

export default async function VolunteerSecurityPage({ searchParams }: { searchParams: Promise<{ google?: string; error?: string }> }) {
  const me = await requireVolunteer();
  const props = await securityProps(me, await searchParams, "/app/security");
  return (
    <div className="flex flex-col gap-5 px-5 pb-6 pt-3">
      <Link href="/app/profile" className="-ml-1 inline-flex min-h-11 items-center gap-1 self-start pr-2 text-sm font-semibold text-muted-foreground hover:text-ink">
        <ChevronLeft className="size-5" aria-hidden /> Me
      </Link>
      <header>
        <h1 className="text-[1.75rem] leading-tight text-ink">Sign-in and security</h1>
        <p className="mt-1 text-muted-foreground">Signed in as {me.email}</p>
      </header>
      <SecuritySettings {...props} />
    </div>
  );
}
