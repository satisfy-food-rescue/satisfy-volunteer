import { HandHelping, Lock, Sparkles } from "lucide-react";
import { requireVolunteer } from "@/lib/session";
import { addDays, formatDay, formatTimeRange, relativeDay, todayISO } from "@/lib/dates";
import { gapsBetween } from "@/lib/roster";
import { trainingContext } from "@/lib/volunteer-data";
import { eligibilityFor } from "@/lib/training";
import { ShiftActions } from "@/components/app/shift-actions";
import { ShiftKindIcon } from "@/components/app/shift-card";
import { EmptyState } from "@/components/shared/empty-state";
import Link from "next/link";
import { cn } from "@/lib/utils";

export const metadata = { title: "Open gaps" };

export default async function GapsPage() {
  const me = await requireVolunteer();
  const today = todayISO();
  const [gaps, training] = await Promise.all([gapsBetween(today, addDays(today, 28)), trainingContext(me, today)]);
  const list = gaps.filter((g) => !g.released.some((r) => r.volunteerId === me.id));
  const byDate = new Map<string, typeof list>();
  for (const g of list) byDate.set(g.iso, [...(byDate.get(g.iso) ?? []), g]);

  return (
    <div className="flex flex-col gap-5 px-5 pb-6 pt-5">
      <div>
        <p className="eyebrow">Next four weeks</p>
        <h1 className="mt-1 text-3xl text-ink">Shifts that need cover</h1>
        <p className="mt-2 text-muted-foreground">
          When someone is away, their shift shows up here. If you can step in, tap the button and it is yours.
        </p>
      </div>

      {list.length === 0 ? (
        <EmptyState icon={Sparkles} title="Everything is covered" description="No open gaps in the next four weeks. Check back after the weekend." action={<Link href="/app/shifts" className="font-semibold text-teal hover:underline">Browse all shifts</Link>} />
      ) : (
        [...byDate.entries()].map(([iso, items]) => (
          <section key={iso} aria-labelledby={`gap-${iso}`}>
            <h2 id={`gap-${iso}`} className="mb-2 flex items-baseline gap-2 text-lg text-ink">
              {relativeDay(iso, today)}
              <span className="text-sm font-sans text-muted-foreground tabular">{relativeDay(iso, today) !== formatDay(iso) ? formatDay(iso) : ""}</span>
            </h2>
            <div className="flex flex-col gap-2.5">
              {items.map((view) => {
                const elig = eligibilityFor(me, view.kind, training.statuses);
                const mine = view.confirmed.find((a) => a.volunteerId === me.id) ?? null;
                return (
                  <article key={view.shift.id} className={cn("rounded-2xl border bg-card p-4 shadow-sm", mine ? "border-green/60" : "border-orange/60")}>
                    <div className="flex items-start gap-3">
                      <span className={view.kind === "WAREHOUSE" ? "flex size-11 shrink-0 items-center justify-center rounded-xl bg-green-tint text-green-deep" : "flex size-11 shrink-0 items-center justify-center rounded-xl bg-sky-tint text-sky-text"}>
                        <ShiftKindIcon kind={view.kind} className="size-6" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <Link href={`/app/shifts/${view.shift.id}`} className="block font-bold text-ink hover:underline">{view.shift.template.name}</Link>
                        <p className="text-sm text-muted-foreground tabular">{formatTimeRange(view.shift.startTime, view.shift.endTime)} · {view.location}</p>
                        <p className="mt-1.5 inline-flex items-start gap-1.5 text-sm font-semibold text-orange-text">
                          <HandHelping className="mt-0.5 size-4 shrink-0" aria-hidden />
                          <span>Needs {view.shortBy} more. {view.causes[0]}.</span>
                        </p>
                      </div>
                    </div>
                    <div className="mt-3">
                      <ShiftActions
                        compact
                        state={{ shiftId: view.shift.id, mine: mine ? { id: mine.id, source: mine.source } : null, isPast: false, isFull: view.isFull, isGap: true, eligible: elig.eligible, reason: elig.reason, blockerModuleCode: elig.blockers[0]?.module.code ?? null }}
                      />
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))
      )}
      {list.some((g) => !eligibilityFor(me, g.kind, training.statuses).eligible) && (
        <p className="inline-flex items-start gap-2 text-sm text-muted-foreground">
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
          Locked shifts open up as soon as the training they need is current.
        </p>
      )}
    </div>
  );
}
