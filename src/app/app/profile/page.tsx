import Link from "next/link";
import { CalendarCheck, KeyRound, LogOut, RefreshCw, Sprout, ChevronRight } from "lucide-react";
import { requireVolunteer } from "@/lib/session";
import { isDemo } from "@/lib/env";
import { formatInstant, formatDate, dateToISO } from "@/lib/dates";
import { ROLE_LABEL, fullName } from "@/lib/domain";
import { AvatarBadge } from "@/components/shared/avatar-badge";
import { Chip } from "@/components/shared/status-chip";
import { ProfileForm } from "@/components/app/profile-form";
import { RoleChangeRequest } from "@/components/app/role-change-request";
import { signOut } from "@/app/sign-in/actions";
import { Button } from "@/components/ui/button";

export const metadata = { title: "My profile" };

export default async function ProfilePage() {
  const me = await requireVolunteer();
  const demo = isDemo();
  return (
    <div className="flex flex-col gap-6 px-5 pb-6 pt-5">
      <header className="flex items-center gap-4">
        <AvatarBadge person={me} size="lg" />
        <div className="min-w-0">
          <h1 className="text-[1.75rem] leading-tight text-ink">{fullName(me)}</h1>
          <p className="text-sm text-muted-foreground">Volunteer since {formatDate(dateToISO(me.joinedAt))}</p>
          {me.inHarvestPool && <div className="mt-1.5"><Chip tone="info" size="sm" icon={Sprout}>Harvest pool</Chip></div>}
        </div>
      </header>

      <section aria-labelledby="roles-h" className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        <div>
          <h2 id="roles-h" className="text-xl text-ink">My roles</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Your roles decide which shifts you can book and which training applies.</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {me.roles.map((r) => <Chip key={r} tone="good">{ROLE_LABEL[r]}</Chip>)}
        </div>
        <RoleChangeRequest />
      </section>

      {me.infoodleId && (
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
          <RefreshCw className="size-5 shrink-0 text-green-text" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-ink">Synced with Infoodle</p>
            <p className="text-sm text-muted-foreground">
              {me.infoodleSyncedAt ? `Last synced ${formatInstant(me.infoodleSyncedAt)}` : "Not yet synced"} · <span className="whitespace-nowrap">record {me.infoodleId}</span>
            </p>
          </div>
        </div>
      )}

      <nav aria-label="Profile sections" className="overflow-hidden rounded-2xl border border-border bg-card">
        {[
          { href: "/app/slot", label: "My regular slot and absences", icon: CalendarCheck },
          { href: "/app/harvest", label: "Harvest pool", icon: Sprout },
          { href: "/app/security", label: "Sign-in and security", icon: KeyRound },
        ].map((l) => (
          <Link key={l.href} href={l.href} className="flex min-h-14 items-center gap-3 border-b border-border px-4 last:border-b-0 hover:bg-muted">
            <l.icon className="size-5 text-green-text" aria-hidden />
            <span className="flex-1 font-semibold text-ink">{l.label}</span>
            <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
          </Link>
        ))}
      </nav>

      <ProfileForm
        email={me.email}
        initial={{ phone: me.phone ?? "", suburb: me.suburb ?? "", emergencyName: me.emergencyName ?? "", emergencyPhone: me.emergencyPhone ?? "", availabilityNote: me.availabilityNote ?? "", lastMinuteOk: me.lastMinuteOk }}
      />

      <form action={signOut} className="flex flex-col gap-2 border-t border-border pt-5">
        <Button type="submit" variant="outline" size="lg" className="h-12 text-base">
          <LogOut className="size-5" aria-hidden /> {demo ? "Switch persona" : "Sign out"}
        </Button>
        {demo && <p className="text-center text-xs text-muted-foreground">Demo only: returns to the persona picker.</p>}
      </form>
    </div>
  );
}
