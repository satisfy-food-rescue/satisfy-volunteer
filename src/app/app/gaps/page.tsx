import { HandHelping, Lock, Sparkles } from "lucide-react";
import { requireVolunteer } from "@/lib/session";
import { formatDay, formatTimeRange, relativeDay, todayISO } from "@/lib/dates";
import { coverGaps, trainingContext } from "@/lib/volunteer-data";
import { eligibilityFor } from "@/lib/training";
import { ShiftActions } from "@/components/app/shift-actions";
import { LockedShiftCard, ShiftKindIcon, kindTileClass } from "@/components/app/shift-card";
import { LockBanner } from "@/components/app/lock-banner";
import { AppPage, AppPageHeader } from "@/components/app/app-page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";

export const metadata = { title: "Shifts that need cover" };

export default async function GapsPage() {
  const me = await requireVolunteer();
  const today = todayISO();
  const [gaps, training] = await Promise.all([coverGaps(me.id, today), trainingContext(me, today)]);
  const rows = gaps.map((view) => ({ view, elig: eligibilityFor(me, view.kind, training.statuses), mine: view.confirmed.find((a) => a.volunteerId === me.id) ?? null }));
  // The shifts the volunteer can take (or is already on) lead, by day. Locked
  // ones follow, small and grey, with the reason said once at the top.
  const open = rows.filter((r) => r.mine || r.elig.eligible);
  const locked = rows.filter((r) => !r.mine && !r.elig.eligible);
  const byDate = new Map<string, typeof open>();
  for (const r of open) byDate.set(r.view.iso, [...(byDate.get(r.view.iso) ?? []), r]);
  const lockedByRole = locked.some((r) => !r.elig.hasRole);
  const lockedByTraining = locked.some((r) => r.elig.hasRole);

  return (
    <AppPage className="gap-5">
      <AppPageHeader
        eyebrow="Next four weeks"
        title="Shifts that need cover"
        description="When someone is away, their shift shows up here. If you can step in, tap the button and it is yours."
      />

      {gaps.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="Everything is covered"
          description="No open gaps in the next four weeks. Check back soon."
          action={<Button variant="outline" className="h-11" render={<Link href="/app/shifts" />}>Browse all shifts</Button>}
        />
      ) : (
        <>
          {locked.length > 0 && (
            <LockBanner
              title={open.length > 0 ? "Some of these shifts are locked for you" : "None of these are open to you yet"}
              locks={locked.map((r) => r.elig)}
            />
          )}
          {[...byDate.entries()].map(([iso, items]) => {
            const label = relativeDay(iso, today);
            const day = formatDay(iso);
            return (
              <section
                key={iso}
                aria-labelledby={`gap-${iso}`}
                className="@3xl/app:grid @3xl/app:grid-cols-[8.5rem_minmax(0,1fr)] @3xl/app:gap-6 @3xl/app:border-t @3xl/app:border-border @3xl/app:pt-5"
              >
                <h2 id={`gap-${iso}`} className="mb-2 flex items-baseline gap-2 text-lg text-ink @3xl/app:mb-0 @3xl/app:flex-col @3xl/app:gap-1 @3xl/app:text-xl">
                  {label}
                  {label !== day && <span className="font-sans text-sm text-muted-foreground tabular">{day}</span>}
                </h2>
                <div className="flex flex-col gap-2.5 @3xl/app:gap-3">
                  {items.map(({ view, elig, mine }) => (
                    <article key={view.shift.id} className={cn("rounded-2xl border bg-card p-4 shadow-sm @4xl/app:flex @4xl/app:items-center @4xl/app:gap-8 @4xl/app:p-5", mine ? "border-green/60" : "border-orange/60")}>
                      <div className="flex items-start gap-3 @4xl/app:min-w-0 @4xl/app:flex-1">
                        <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", kindTileClass(view.kind))}>
                          <ShiftKindIcon kind={view.kind} className="size-6" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <Link href={`/app/shifts/${view.shift.id}`} className="block font-bold text-ink hover:underline">{view.name}</Link>
                          <p className="text-sm text-muted-foreground tabular">{formatTimeRange(view.shift.startTime, view.shift.endTime)} · {view.location}</p>
                          <p className="mt-1.5 inline-flex items-start gap-1.5 text-sm font-semibold text-orange-text">
                            <HandHelping className="mt-0.5 size-4 shrink-0" aria-hidden />
                            <span>Needs {view.shortBy} more. {view.crewCauses[0]}.</span>
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 @4xl/app:mt-0 @4xl/app:w-[19rem] @4xl/app:shrink-0">
                        <ShiftActions
                          compact
                          state={{ shiftId: view.shift.id, mine: mine ? { id: mine.id, source: mine.source } : null, isPast: false, isCancelled: false, isFull: view.isFull, isGap: true, eligible: elig.eligible, reason: elig.reason, blockerModuleCode: elig.blockers[0]?.module.code ?? null, missingRole: !elig.hasRole, harvest: false }}
                        />
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
          {locked.length > 0 && (
            <section
              aria-labelledby="locked-h"
              className="@3xl/app:grid @3xl/app:grid-cols-[8.5rem_minmax(0,1fr)] @3xl/app:gap-6 @3xl/app:border-t @3xl/app:border-border @3xl/app:pt-5"
            >
              <h2 id="locked-h" className="mb-2 flex items-baseline gap-2 text-lg text-muted-foreground @3xl/app:mb-0 @3xl/app:flex-col @3xl/app:gap-1 @3xl/app:text-xl">
                <span className="inline-flex items-center gap-1.5">
                  <Lock className="size-4.5 shrink-0" aria-hidden />
                  Locked
                </span>
                <span className="font-sans text-sm tabular">
                  {locked.length} {locked.length === 1 ? "shift" : "shifts"}
                </span>
              </h2>
              <div className="flex flex-col gap-2">
                <ul className="grid gap-2 @4xl/app:grid-cols-2">
                  {locked.map(({ view, elig }) => (
                    <li key={view.shift.id}>
                      <LockedShiftCard view={view} needsRole={!elig.hasRole} showDate />
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-muted-foreground">
                  {lockedByRole && lockedByTraining
                    ? "These open up once you have the role and the training they need."
                    : lockedByRole
                      ? "These open up once you have the role they need."
                      : "These open up as soon as the training they need is current."}
                </p>
              </div>
            </section>
          )}
        </>
      )}
    </AppPage>
  );
}

