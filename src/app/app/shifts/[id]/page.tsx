import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Clock, MapPin, Store, UserRound, Users } from "lucide-react";
import { requireVolunteer } from "@/lib/session";
import { formatDayLong, formatTimeRange, relativeDay, todayISO } from "@/lib/dates";
import { shiftById } from "@/lib/roster";
import { trainingContext } from "@/lib/volunteer-data";
import { eligibilityFor } from "@/lib/training";
import { db } from "@/lib/db";
import { AvatarBadge } from "@/components/shared/avatar-badge";
import { Chip } from "@/components/shared/status-chip";
import { ShiftActions } from "@/components/app/shift-actions";
import { ShiftKindIcon } from "@/components/app/shift-card";
import { fullName } from "@/lib/domain";
import { HandHelping } from "lucide-react";

export const metadata = { title: "Shift" };

export default async function ShiftDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireVolunteer();
  const { id } = await params;
  const view = await shiftById(id);
  if (!view) notFound();
  const today = todayISO();
  const training = await trainingContext(me, today);
  const elig = eligibilityFor(me, view.kind, training.statuses);
  const donors = view.shift.template.routeId
    ? await db.donor.findMany({ where: { routeId: view.shift.template.routeId } })
    : [];
  const mine = view.confirmed.find((a) => a.volunteerId === me.id) ?? null;
  const blocker = elig.blockers[0]?.module.code ?? null;

  return (
    <div className="flex flex-col gap-6 px-5 pb-6 pt-3">
      <Link href="/app/shifts" className="-ml-2 inline-flex min-h-11 items-center gap-1 self-start pr-2 text-sm font-semibold text-muted-foreground hover:text-ink">
        <ChevronLeft className="size-5" aria-hidden /> Shifts
      </Link>

      <header className="flex items-start gap-4">
        <span className={view.kind === "WAREHOUSE" ? "flex size-14 shrink-0 items-center justify-center rounded-2xl bg-green-tint text-green-deep" : "flex size-14 shrink-0 items-center justify-center rounded-2xl bg-sky-tint text-sky-text"}>
          <ShiftKindIcon kind={view.kind} className="size-7" />
        </span>
        <div className="min-w-0">
          <p className="eyebrow">{relativeDay(view.iso, today)}</p>
          <h1 className="mt-1 text-[1.75rem] leading-tight text-ink">{view.shift.template.name}</h1>
        </div>
      </header>

      <dl className="grid gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <Clock className="mt-0.5 size-5 shrink-0 text-sky" aria-hidden />
          <div>
            <dt className="sr-only">When</dt>
            <dd className="font-bold text-ink">{formatDayLong(view.iso)}</dd>
            <dd className="text-ink-soft tabular">{formatTimeRange(view.shift.startTime, view.shift.endTime)}</dd>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <MapPin className="mt-0.5 size-5 shrink-0 text-sky" aria-hidden />
          <div>
            <dt className="sr-only">Where</dt>
            <dd className="text-ink">{view.location}</dd>
            {view.shift.template.route?.isVolunteerDriven && <dd className="text-sm text-muted-foreground">Fully volunteer-driven route</dd>}
          </div>
        </div>
        {view.shift.template.workingWith && (
          <div className="flex items-start gap-3">
            <UserRound className="mt-0.5 size-5 shrink-0 text-sky" aria-hidden />
            <div>
              <dt className="sr-only">Working with</dt>
              <dd className="text-ink">Working with {view.shift.template.workingWith}</dd>
            </div>
          </div>
        )}
        {donors.length > 0 && (
          <div className="flex items-start gap-3">
            <Store className="mt-0.5 size-5 shrink-0 text-sky" aria-hidden />
            <div>
              <dt className="sr-only">Stops</dt>
              <dd className="text-ink">{donors.map((d) => d.name).join(", ")}</dd>
            </div>
          </div>
        )}
        <div className="flex items-start gap-3">
          <Users className="mt-0.5 size-5 shrink-0 text-sky" aria-hidden />
          <div className="flex flex-wrap items-center gap-2">
            <dt className="sr-only">Crew</dt>
            <dd className="text-ink tabular">{view.confirmedCount} of {view.shift.capacity} places filled</dd>
            {view.isGap && <Chip tone="bad" icon={HandHelping} size="sm">Needs {view.shortBy} more</Chip>}
          </div>
        </div>
      </dl>

      {view.isGap && view.causes.length > 0 && (
        <p className="rounded-xl bg-orange-tint px-4 py-3 text-sm font-semibold text-orange-text">
          {view.causes.join(". ")}.
        </p>
      )}

      <ShiftActions
        state={{ shiftId: view.shift.id, mine: mine ? { id: mine.id, source: mine.source } : null, isPast: view.iso < today, isCancelled: view.shift.status === "CANCELLED", isFull: view.isFull, isGap: view.isGap, eligible: elig.eligible, reason: elig.reason, blockerModuleCode: blocker, missingRole: !elig.hasRole }}
      />

      <section aria-labelledby="crew">
        <h2 id="crew" className="mb-2 text-xl text-ink">Who&apos;s on</h2>
        {view.confirmed.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">Nobody yet. Be the first.</p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {view.confirmed.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                <AvatarBadge person={a.volunteer} size="sm" />
                <span className="flex-1 font-semibold text-ink">
                  {a.volunteerId === me.id ? "You" : fullName(a.volunteer)}
                </span>
                {a.source === "COVER" && <Chip tone="info" size="sm">Covering</Chip>}
                {a.source === "REGULAR" && <span className="text-xs text-muted-foreground">Regular</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
