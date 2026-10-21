import { HandHelping, Lock, Sparkles } from "lucide-react";
import { requireVolunteer } from "@/lib/session";
import { formatDay, formatTimeRange, relativeDay, todayISO } from "@/lib/dates";
import { coverableGaps, trainingContext } from "@/lib/volunteer-data";
import { eligibilityFor } from "@/lib/training";
import { ShiftActions } from "@/components/app/shift-actions";
import { ShiftKindIcon, kindTileClass } from "@/components/app/shift-card";
import { AppPage, AppPageHeader } from "@/components/app/app-page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";

export const metadata = { title: "Shifts that need cover" };

export default async function GapsPage() {
  const me = await requireVolunteer();
  const today = todayISO();
  const [list, training] = await Promise.all([coverableGaps(me.id, today), trainingContext(me, today)]);
  const byDate = new Map<string, typeof list>();
  for (const g of list) byDate.set(g.iso, [...(byDate.get(g.iso) ?? []), g]);
  const locked = list.map((g) => eligibilityFor(me, g.kind, training.statuses)).filter((e) => !e.eligible);
  const lockedByRole = locked.some((e) => !e.hasRole);
  const lockedByTraining = locked.some((e) => e.hasRole);

  return (
    <AppPage className="gap-5">
      <AppPageHeader
        eyebrow="Next four weeks"
        title="Shifts that need cover"
        description="When someone is away, their shift shows up here. If you can step in, tap the button and it is yours."
      />

      {list.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="Everything is covered"
          description="No open gaps in the next four weeks. Check back soon."
          action={<Button variant="outline" className="h-11" render={<Link href="/app/shifts" />}>Browse all shifts</Button>}
        />
      ) : (
        [...byDate.entries()].map(([iso, items]) => {
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
                {items.map((view) => {
                  const elig = eligibilityFor(me, view.kind, training.statuses);
                  const mine = view.confirmed.find((a) => a.volunteerId === me.id) ?? null;
                  return (
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
                            <span>Needs {view.shortBy} more. {view.causes[0]}.</span>
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
                  );
                })}
              </div>
            </section>
          );
        })
      )}
      {locked.length > 0 && (
        <p className="inline-flex items-start gap-2 text-sm text-muted-foreground">
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
          {lockedByRole && lockedByTraining
            ? "Locked shifts open up once you have the role and the training they need."
            : lockedByRole
              ? "Locked shifts open up once you have the role they need."
              : "Locked shifts open up as soon as the training they need is current."}
        </p>
      )}
    </AppPage>
  );
}
