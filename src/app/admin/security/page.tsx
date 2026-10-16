import { requireAdmin } from "@/lib/session";
import { securityProps } from "@/lib/security-data";
import { PageHeader } from "@/components/shared/page-header";
import { SecuritySettings } from "@/components/auth/security-settings";

export const metadata = { title: "Sign-in and security" };

export default async function AdminSecurityPage({ searchParams }: { searchParams: Promise<{ google?: string; error?: string }> }) {
  const me = await requireAdmin();
  const props = await securityProps(me, await searchParams, "/admin/security");
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <PageHeader eyebrow="Your account" title="Sign-in and security" description={`Signed in as ${me.email}.`} />
      <SecuritySettings {...props} />
    </div>
  );
}
