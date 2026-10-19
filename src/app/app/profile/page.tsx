import Link from "next/link";
import { CalendarCheck, KeyRound, LogOut, RefreshCw, Sprout, ChevronRight } from "lucide-react";
import { requireVolunteer } from "@/lib/session";
import { isDemo } from "@/lib/env";
import { formatInstant, formatDate, dateToISO } from "@/lib/dates";
import { ROLE_LABEL, fullName } from "@/lib/domain";
import { AvatarBadge } from "@/components/shared/avatar-badge";
import { Chip } from "@/components/shared/status-chip";
import { ProfileForm } from "@/components/app/profile-form";
import { LegalLinks } from "@/components/auth/auth-shell";
import { RoleChangeRequest } from "@/components/app/role-change-request";
import { signOut } from "@/app/sign-in/actions";
import { Button } from "@/components/ui/button";
import { AppPage } from "@/components/app/app-page-header";

export const metadata = { title: "My profile" };

export default async function ProfilePage() {
  const me = await requireVolunteer();
  const demo = isDemo();
  return (
    <AppPage>
      <header className="flex items-center gap-4 @3xl/app:gap-6">
        <AvatarBadge person={me} size="lg" className="@3xl/app:size-20 @3xl/app:text-2xl" />
        <div className="min-w-0">
          <h1 className="break-words text-3xl leading-tight text-ink @3xl/app:text-4xl @6xl/app:text-[2.75rem]">{fullName(me)}</h1>
          <p className="text-sm text-muted-foreground @3xl/app:mt-1 @3xl/app:text-base">Volunteer since {formatDate(dateToISO(me.joinedAt))}</p>
          {!demo && me.infoodleId && <p className="text-sm text-muted-foreground">Infoodle record {me.infoodleId}</p>}
        </div>
      </header>

      {/* One column on a phone, ending with sign out. With room, who you are
          and how you sign out sit on the left, your details on the right. */}
      <div className="flex flex-col gap-6 @4xl/app:grid @4xl/app:grid-cols-12 @4xl/app:items-start @4xl/app:gap-8">
        <div className="contents @4xl/app:col-span-5 @4xl/app:flex @4xl/app:flex-col @4xl/app:gap-6 @6xl/app:col-span-4">
          <section aria-labelledby="roles-h" className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 @3xl/app:p-5">
            <div>
              <h2 id="roles-h" className="text-xl text-ink">My roles</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">Your roles decide which shifts you can book and which training applies.</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {me.roles.map((r) => <Chip key={r} tone="good">{ROLE_LABEL[r]}</Chip>)}
            </div>
            <RoleChangeRequest />
          </section>

          {/* Infoodle sync only runs in the demo, so production claims nothing about it. */}
          {demo && me.infoodleId && (
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
              <RefreshCw className="size-5 shrink-0 text-sky" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">Synced with Infoodle</p>
                <p className="text-sm text-muted-foreground">
                  {me.infoodleSyncedAt ? `Last synced ${formatInstant(me.infoodleSyncedAt)}` : "Not yet synced"} · <span className="whitespace-nowrap">record {me.infoodleId}</span>
                </p>
              </div>
            </div>
          )}

          {/* The sidebar lists these from 1024px. */}
          <nav aria-label="Profile sections" className="overflow-hidden rounded-2xl border border-border bg-card lg:hidden">
            {[
              { href: "/app/slot", label: "My regular slot and absences", icon: CalendarCheck },
              { href: "/app/harvest", label: "Harvest", icon: Sprout },
              { href: "/app/security", label: "Sign-in and security", icon: KeyRound },
            ].map((l) => (
              <Link key={l.href} href={l.href} className="flex min-h-14 items-center gap-3 border-b border-border px-4 last:border-b-0 hover:bg-muted">
                <l.icon className="size-5 text-teal" aria-hidden />
                <span className="flex-1 font-semibold text-ink">{l.label}</span>
                <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
              </Link>
            ))}
          </nav>

          <form action={signOut} className="order-last flex flex-col gap-2 border-t border-border pt-5 @4xl/app:order-none">
            <Button type="submit" variant="outline" size="lg" className="h-12 text-base">
              <LogOut className="size-5" aria-hidden /> {demo ? "Switch persona" : "Sign out"}
            </Button>
            {demo && <p className="text-center text-xs text-muted-foreground">Demo only: returns to the persona picker.</p>}
          </form>

          <LegalLinks className="order-last @4xl/app:order-none @4xl/app:justify-start" />
        </div>

        <div className="@4xl/app:col-span-7 @6xl/app:col-span-8">
          <ProfileForm
            email={me.email}
            initial={{ phone: me.phone ?? "", suburb: me.suburb ?? "", emergencyName: me.emergencyName ?? "", emergencyPhone: me.emergencyPhone ?? "", availabilityNote: me.availabilityNote ?? "", lastMinuteOk: me.lastMinuteOk }}
          />
        </div>
      </div>
    </AppPage>
  );
}
