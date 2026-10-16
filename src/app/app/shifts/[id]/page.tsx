import { notFound } from "next/navigation";
import { Clock, HandHelping, MapPin, MessageSquareText, Store, UserRound, Users, type LucideIcon } from "lucide-react";
import { requireVolunteer } from "@/lib/session";
import { formatDayLong, formatTimeRange, relativeDay, todayISO } from "@/lib/dates";
import { shiftById } from "@/lib/roster";
import { trainingContext } from "@/lib/volunteer-data";
import { eligibilityFor } from "@/lib/training";
import { db } from "@/lib/db";
import { AvatarBadge } from "@/components/shared/avatar-badge";
import { Chip } from "@/components/shared/status-chip";
import { EmptyState } from "@/components/shared/empty-state";
import { ShiftActions } from "@/components/app/shift-actions";
import { APP_COLUMN_SIZES, Photo, shiftPhoto } from "@/components/shared/photo";
import { AppPageHeader, BackLink } from "@/components/app/app-page-header";
import { fullName } from "@/lib/domain";

export const metadata = { title: "Shift" };

/** One term and its details. The icon stands in for the term, which screen
 *  readers still hear. */
function DetailRow({ icon: Icon, term, children }: { icon: LucideIcon; term: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <dt className="flex shrink-0">
        <Icon className="mt-0.5 size-5 text-sky" aria-hidden />
        <span className="sr-only">{term}</span>
      </dt>
      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  );
}

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
  const harvest = view.kind === "HARVEST";

  return (
    <div className="flex flex-col gap-6 px-5 pb-6 pt-3">
      <BackLink href={harvest ? "/app/harvest" : "/app/shifts"} label={harvest ? "Harvest" : "Shifts"} />

      <div className="flex flex-col gap-4">
        <Photo photo={shiftPhoto(view.kind)} sizes={APP_COLUMN_SIZES} preload className="aspect-[16/9] rounded-2xl" />
        <AppPageHeader eyebrow={relativeDay(view.iso, today)} title={view.name} />
      </div>

      <dl className="grid gap-3 rounded-2xl border border-border bg-card p-4">
        <DetailRow icon={Clock} term="When">
          <p className="font-bold text-ink">{formatDayLong(view.iso)}</p>
          <p className="text-ink-soft tabular">{formatTimeRange(view.shift.startTime, view.shift.endTime)}</p>
        </DetailRow>
        <DetailRow icon={MapPin} term="Where">
          <p className="text-ink">{view.location}</p>
          {view.shift.template.route?.isVolunteerDriven && <p className="text-sm text-muted-foreground">Fully volunteer-driven route</p>}
        </DetailRow>
        {view.shift.template.workingWith && (
          <DetailRow icon={UserRound} term="Working with">
            <p className="text-ink">Working with {view.shift.template.workingWith}</p>
          </DetailRow>
        )}
        {donors.length > 0 && (
          <DetailRow icon={Store} term="Stops">
            <p className="text-ink">{donors.map((d) => d.name).join(", ")}</p>
          </DetailRow>
        )}
        <DetailRow icon={Users} term="Crew">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-ink tabular">{view.confirmedCount} of {view.shift.capacity} places filled</span>
            {view.isGap && <Chip tone="warn" icon={HandHelping} size="sm">Needs {view.shortBy} more</Chip>}
          </div>
        </DetailRow>
      </dl>

      {view.shift.notes && (
        <section aria-labelledby="notes-h" className="rounded-2xl bg-teal-tint-soft p-4">
          <h2 id="notes-h" className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-teal-deep">
            <MessageSquareText className="size-4" aria-hidden /> From the coordinator
          </h2>
          <p className="mt-2 whitespace-pre-line text-ink">{view.shift.notes}</p>
        </section>
      )}

      {view.isGap && view.causes.length > 0 && (
        <p className="rounded-xl bg-orange-tint px-4 py-3 text-sm font-semibold text-orange-text">
          {view.causes.join(". ")}.
        </p>
      )}

      <ShiftActions
        state={{ shiftId: view.shift.id, mine: mine ? { id: mine.id, source: mine.source } : null, isPast: view.iso < today, isCancelled: view.shift.status === "CANCELLED", isFull: view.isFull, isGap: view.isGap, eligible: elig.eligible, reason: elig.reason, blockerModuleCode: blocker, missingRole: !elig.hasRole, harvest }}
      />

      <section aria-labelledby="crew">
        <h2 id="crew" className="mb-2 text-xl text-ink">Who&apos;s on</h2>
        {view.confirmed.length === 0 ? (
          <EmptyState icon={Users} title="Nobody yet" description="Be the first." className="py-6" />
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {view.confirmed.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                <AvatarBadge person={a.volunteer} size="sm" />
                <span className="min-w-0 flex-1 truncate font-semibold text-ink">
                  {a.volunteerId === me.id ? "You" : fullName(a.volunteer)}
                </span>
                {a.source === "COVER" && <Chip tone="info" size="sm">Covering</Chip>}
                {a.source === "REGULAR" && <Chip tone="neutral" size="sm">Regular</Chip>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
