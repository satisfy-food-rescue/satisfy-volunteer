import { requireVolunteer } from "@/lib/session";
import { securityProps } from "@/lib/security-data";
import { SecuritySettings } from "@/components/auth/security-settings";
import { AppPage, AppPageHeader } from "@/components/app/app-page-header";

export const metadata = { title: "Sign-in and security" };

export default async function VolunteerSecurityPage({ searchParams }: { searchParams: Promise<{ google?: string; apple?: string; error?: string }> }) {
  const me = await requireVolunteer();
  const props = await securityProps(me, await searchParams, "/app/security");
  return (
    <AppPage width="reading" className="gap-5 pt-3">
      <AppPageHeader
        back={{ href: "/app/profile", label: "Me", tabBarOnly: true }}
        title="Sign-in and security"
        description={<>Signed in as <span className="break-all">{me.email}</span></>}
      />
      <SecuritySettings {...props} />
    </AppPage>
  );
}
