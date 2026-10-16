import { requireVolunteer } from "@/lib/session";
import { securityProps } from "@/lib/security-data";
import { SecuritySettings } from "@/components/auth/security-settings";
import { AppPageHeader } from "@/components/app/app-page-header";

export const metadata = { title: "Sign-in and security" };

export default async function VolunteerSecurityPage({ searchParams }: { searchParams: Promise<{ google?: string; error?: string }> }) {
  const me = await requireVolunteer();
  const props = await securityProps(me, await searchParams, "/app/security");
  return (
    <div className="flex flex-col gap-5 px-5 pb-6 pt-3">
      <AppPageHeader
        back={{ href: "/app/profile", label: "Me" }}
        title="Sign-in and security"
        description={<>Signed in as <span className="break-all">{me.email}</span></>}
      />
      <SecuritySettings {...props} />
    </div>
  );
}
