import { notFound } from "next/navigation";
import { Clock, HandHelping, MapPin, MessageSquareText, Store, UserRound, Users, type LucideIcon } from "lucide-react";
import { requireVolunteer } from "@/lib/session";
import { formatDay, formatDayLong, formatTimeRange, relativeDays, todayISO } from "@/lib/dates";
import { shiftById } from "@/lib/roster";
import { trainingContext } from "@/lib/volunteer-data";
import { eligibilityFor } from "@/lib/training";
import { db } from "@/lib/db";
import { AvatarBadge } from "@/components/shared/avatar-badge";
import { Chip } from "@/components/shared/status-chip";
import { EmptyState } from "@/components/shared/empty-state";
import { ShiftActions } from "@/components/app/shift-actions";
import { Photo, shiftPhoto } from "@/components/shared/photo";
import { AppPage, AppPageHeader, BackLink } from "@/components/app/app-page-header";
import { fullName } from "@/lib/domain";
import { cn } from "@/lib/utils";

export const metadata = { title: "Shift" };

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** One term and its details. The icon stands in for the term, which screen
 *  readers still hear. */
function DetailRow({ icon: Icon, term, className, children }: { icon: LucideIcon; term: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex items-start gap-3", className)}>
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

  const actions = (
    <ShiftActions
      state={{ shiftId: view.shift.id, mine: mine ? { id: mine.id, source: mine.source } : null, isPast: view.iso < today, isCancelled: view.shift.status === "CANCELLED", isFull: view.isFull, isGap: view.isGap, eligible: elig.eligible, reason: elig.reason, blockerModuleCode: blocker, missingRole: !elig.hasRole, harvest }}
    />
  );

  // Upcoming shifts get a summary beside the button on wider screens, which
  // then carries the date, time and places instead of the details card.
  const summary = (view.isGap && view.crewCauses.length > 0) || view.iso >= today;

  // On a phone everything runs in one column. With room, the photo and the
  // details sit on the left and what to do and who is on stay in view on the
  // right.
  return (
    <AppPage className="pt-3">
      <BackLink href={harvest ? "/app/harvest" : "/app/shifts"} label={harvest ? "Harvest" : "Shifts"} className="@3xl/app:-mb-4" />

      <div className="grid gap-6 @4xl/app:grid-cols-12 @4xl/app:items-start @4xl/app:gap-8">
        <div className="flex flex-col gap-6 @4xl/app:col-span-7 @6xl/app:col-span-8">
          <div className="flex flex-col gap-4 @3xl/app:gap-6">
            <Photo photo={shiftPhoto(view.kind)} sizes="(min-width: 80rem) 50vw, (min-width: 64rem) 45vw, calc(100vw - 2.5rem)" preload className="aspect-[16/9] rounded-2xl @3xl/app:aspect-[21/9] @3xl/app:rounded-3xl" />
            <AppPageHeader eyebrow={capitalise(relativeDays(view.iso, today))} title={view.name} />
          </div>

          <dl className="grid gap-3 rounded-2xl border border-border bg-card p-4 @3xl/app:grid-cols-2 @3xl/app:gap-x-8 @3xl/app:gap-y-5 @3xl/app:p-6">
            <DetailRow icon={Clock} term="When" className={summary ? "@4xl/app:hidden" : undefined}>
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
            <DetailRow icon={Users} term="Crew" className={summary ? "@4xl/app:hidden" : undefined}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-ink tabular">{view.confirmedCount} of {view.shift.capacity} places filled</span>
                {view.isGap && <Chip tone="warn" icon={HandHelping} size="sm">Needs {view.shortBy} more</Chip>}
              </div>
            </DetailRow>
          </dl>

          {view.shift.notes && (
            <section aria-labelledby="notes-h" className="rounded-2xl bg-teal-tint-soft p-4 @3xl/app:p-6">
              <h2 id="notes-h" className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-teal-deep">
                <MessageSquareText className="size-4" aria-hidden /> From the coordinator
              </h2>
              <p className="mt-2 max-w-prose whitespace-pre-line text-ink">{view.shift.notes}</p>
            </section>
          )}
        </div>

        <div className="flex flex-col gap-6 @4xl/app:sticky @4xl/app:top-8 @4xl/app:col-span-5 @6xl/app:col-span-4">
          {summary ? (
            <div className="flex flex-col gap-4 @4xl/app:rounded-3xl @4xl/app:border @4xl/app:border-border @4xl/app:bg-card @4xl/app:p-6 @4xl/app:shadow-sm">
              {/* When and how full, beside the button that acts on them. The
                  details card leaves these out at this width. */}
              <div className="hidden @4xl/app:block">
                <p className="font-display text-2xl font-bold text-ink">{formatDay(view.iso)}</p>
                <p className="text-lg text-ink-soft tabular">{formatTimeRange(view.shift.startTime, view.shift.endTime)}</p>
                <div className="mt-4 flex h-2 gap-0.5 overflow-hidden rounded-full" aria-hidden>
                  {Array.from({ length: view.shift.capacity }, (_, i) => (
                    <span key={i} className={cn("flex-1", i < view.confirmedCount ? (view.isGap ? "bg-orange" : "bg-green") : "bg-muted")} />
                  ))}
                </div>
                <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground tabular">
                  {view.confirmedCount} of {view.shift.capacity} places filled
                  {view.isGap && <Chip tone="warn" icon={HandHelping} size="sm">Needs {view.shortBy} more</Chip>}
                </p>
              </div>
              {view.isGap && view.crewCauses.length > 0 && (
                <p className="rounded-xl bg-orange-tint px-4 py-3 text-sm font-semibold text-orange-text">
                  {view.crewCauses.join(". ")}.
                </p>
              )}
              {actions}
            </div>
          ) : null}

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
      </div>
    </AppPage>
  );
}
