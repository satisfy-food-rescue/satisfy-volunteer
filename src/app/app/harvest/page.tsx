import Link from "next/link";
import { CheckCircle2, ChevronRight, Sprout } from "lucide-react";
import { requireVolunteer } from "@/lib/session";
import { todayISO } from "@/lib/dates";
import { loadHarvest } from "@/lib/harvest";
import { eligibilityFor } from "@/lib/training";
import { HarvestPoolToggle } from "@/components/app/harvest-controls";
import { ShiftCard } from "@/components/app/shift-card";
import { AppPage, AppPageHeader } from "@/components/app/app-page-header";
import { TrainingChip } from "@/components/shared/status-chip";
import { EmptyState } from "@/components/shared/empty-state";
import { FoodIcon } from "@/components/brand/logo";
import { Photo } from "@/components/shared/photo";
import { cn } from "@/lib/utils";

export const metadata = { title: "Harvest" };

export default async function HarvestPage() {
  const me = await requireVolunteer();
  const today = todayISO();
  const { inPool, poolCount, harvestTraining, trained, harvests, statuses } = await loadHarvest(me, today);
  const elig = eligibilityFor(me, "HARVEST", statuses);
  const toDo = harvestTraining.filter((s) => s.status === "NOT_STARTED" || s.status === "OVERDUE");

  return (
    <AppPage className="pt-3">
      <AppPageHeader back={{ href: "/app/profile", label: "Me", tabBarOnly: true }} eyebrow="Seasonal" title="Harvest" />

      <section className={cn("overflow-hidden rounded-2xl @3xl/app:grid @3xl/app:grid-cols-2 @3xl/app:rounded-3xl", inPool ? "bg-green-tint-soft ring-1 ring-green/40" : "bg-card ring-1 ring-border")}>
        <Photo photo="harvest" sizes="(min-width: 64rem) 40vw, (min-width: 48rem) 45vw, calc(100vw - 2.5rem)" preload className="aspect-[16/9] @3xl/app:aspect-auto @3xl/app:min-h-80" />
        <div className="p-5 @3xl/app:flex @3xl/app:flex-col @3xl/app:justify-center @3xl/app:p-8 @6xl/app:p-12">
          <div className="flex items-start gap-3">
            <FoodIcon kind="broccoli" className="size-12" />
            <div>
              <p className="font-bold text-ink @3xl/app:font-display @3xl/app:text-2xl">{inPool ? "You're in the harvest pool" : "Join the harvest pool"}</p>
              <p className="mt-1 text-sm text-ink-soft @3xl/app:mt-2 @3xl/app:text-base">
                Whenever fruit is ready, we pick it from orchards and backyard trees that would otherwise waste it. When a harvest is on, everyone in the pool gets an email and a notification, and the first to sign up get the places. {poolCount === 1 ? "1 volunteer is" : `${poolCount} volunteers are`} in the pool.
              </p>
            </div>
          </div>
          <div className="mt-4 @3xl/app:mt-6">
            <HarvestPoolToggle inPool={inPool} />
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-6 @4xl/app:grid @4xl/app:grid-cols-12 @4xl/app:items-start @4xl/app:gap-8">
        {harvestTraining.length > 0 && (
          <section aria-labelledby="harvest-training" className="@4xl/app:col-span-5 @6xl/app:col-span-4">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <h2 id="harvest-training" className="text-xl text-ink">Harvest training</h2>
              {trained && <span className="inline-flex items-center gap-1 text-sm font-semibold text-green-text"><CheckCircle2 className="size-4" aria-hidden />All done</span>}
            </div>
            <p className="mb-3 text-sm text-ink-soft">
              {trained
                ? inPool
                  ? "You can sign up for any harvest with a place left. We run a short in-person induction at your first harvest."
                  : "Your training already covers harvests, so once you join you can sign up straight away."
                : `Complete ${toDo.length === 1 ? "this module" : "these modules"} online before your first harvest. The in-person induction happens on the day.`}
            </p>
            <ul className="flex flex-col gap-2">
              {harvestTraining.map((s) => (
                <li key={s.module.id}>
                  <Link href={`/app/training/${s.module.code}`} className="flex min-h-14 items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm transition-colors hover:border-teal/60">
                    <span className="min-w-0 flex-1 font-semibold text-ink">{s.module.name}</span>
                    <TrainingChip status={s.status} size="sm" className="shrink-0" />
                    <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="harvests" className={harvestTraining.length > 0 ? "@4xl/app:col-span-7 @6xl/app:col-span-8" : "@4xl/app:col-span-12"}>
          <h2 id="harvests" className="mb-2 text-xl text-ink">Upcoming harvests</h2>
          {harvests.length === 0 ? (
            <EmptyState
              icon={Sprout}
              title="No harvests planned right now"
              description={inPool ? "We will email you when the fruit is ready." : "Join the pool to hear when the fruit is ready."}
              className="py-6"
            />
          ) : (
            <div className="grid gap-2.5 @6xl/app:grid-cols-2 @6xl/app:gap-3">
              {/* Outside the pool the join button above says it all; inside, the reason names the module to do. */}
              {harvests.map((view) => (
                <ShiftCard key={view.shift.id} view={view} meId={me.id} eligible={elig.eligible} needsRole={!elig.hasRole} reason={inPool ? elig.reason : null} showDate />
              ))}
            </div>
          )}
        </section>
      </div>
    </AppPage>
  );
}
