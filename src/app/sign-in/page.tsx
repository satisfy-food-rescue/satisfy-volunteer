import type { Metadata } from "next";
import { AlertTriangle, ClipboardList, ShieldCheck, Sprout, Truck, Warehouse } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { db } from "@/lib/db";
import { todayISO, formatDayLong } from "@/lib/dates";
import { fullName } from "@/lib/domain";
import { moduleStatuses, trainingSummary } from "@/lib/training";
import { IMPACT, compactCount, formatCount } from "@/lib/brand";
import { signInAs } from "./actions";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

const PERSONAS = [
  {
    key: "phillipa",
    label: "Coordinator",
    icon: ShieldCheck,
    blurb: "Admin view: roster, gaps, training compliance, applications and the Outbox.",
    surface: "Admin (desktop)",
  },
  {
    key: "margaret",
    label: "Regular warehouse volunteer",
    icon: Warehouse,
    blurb: "Tuesdays and Thursdays on the sorting floor. Training current, one refresher due soon.",
    surface: "Volunteer app",
  },
  {
    key: "tony",
    label: "Driver help, refresher overdue",
    icon: Truck,
    blurb: "Wednesday Rangiora / Kaiapoi route. Manual Handling lapsed, so route shifts are blocked until it is done.",
    surface: "Volunteer app",
  },
  {
    key: "jess",
    label: "New volunteer, no training yet",
    icon: Sprout,
    blurb: "Approved from the Infoodle form two days ago. Needs an initial visit before booking anything.",
    surface: "Volunteer app",
  },
] as const;

export default async function SignInPage() {
  const today = todayISO();
  const [people, modules] = await Promise.all([
    db.volunteer.findMany({
      where: { personaKey: { in: PERSONAS.map((p) => p.key) } },
      include: { trainingRecords: true, regularSlots: { include: { template: true } } },
    }),
    db.trainingModule.findMany(),
  ]);
  const byKey = new Map(people.map((p) => [p.personaKey, p]));

  return (
    <main className="flex flex-1 flex-col">
      <div className="border-b border-border bg-green-tint-soft">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-10 md:flex-row md:items-end md:justify-between md:px-10 md:py-14">
          <div>
            <LogoMark size={96} />
            <h1 className="mt-6 max-w-xl text-4xl text-ink md:text-5xl">
              Volunteer roster, training and cover in one place.
            </h1>
            <p className="mt-3 max-w-xl text-lg text-ink-soft">
              Demo build for Satisfy Food Rescue. Pick a persona to explore. Nothing here sends real email or touches Infoodle.
            </p>
          </div>
          <dl className="grid grid-cols-3 gap-3 md:w-96 md:shrink-0">
            {[
              [compactCount(IMPACT.kgRescued), "kg of kai rescued"],
              [compactCount(IMPACT.meals), "meals shared"],
              [`${formatCount(IMPACT.co2Tonnes)} t`, `CO2e avoided ${IMPACT.co2Period}`],
            ].map(([n, l]) => (
              <div key={l} className="rounded-xl bg-white/80 px-3 py-3 ring-1 ring-green/30">
                <dd className="whitespace-nowrap font-display text-xl font-bold text-green-text tabular sm:text-2xl">{n}</dd>
                <dt className="mt-0.5 text-xs font-semibold leading-snug text-ink-soft">{l}</dt>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="mx-auto w-full max-w-5xl px-5 py-10 md:px-10">
        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-2xl text-ink">Sign in as</h2>
          <p className="text-sm text-muted-foreground">
            Demo date: {formatDayLong(today)}. Seed data is generated relative to today.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {PERSONAS.map((p) => {
            const person = byKey.get(p.key);
            if (!person) return null;
            const summary = trainingSummary(moduleStatuses(person, modules, person.trainingRecords, today));
            const slot = person.regularSlots[0];
            const Icon = p.icon;
            return (
              <form key={p.key} action={signInAs}>
                <input type="hidden" name="persona" value={p.key} />
                <button
                  type="submit"
                  className={cn(
                    "group flex w-full flex-col gap-3 rounded-2xl border border-border bg-card p-5 text-left shadow-sm transition-all",
                    "hover:-translate-y-0.5 hover:border-green hover:shadow-md active:translate-y-0",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex size-12 items-center justify-center rounded-xl bg-green-tint text-green-deep">
                      <Icon className="size-6" aria-hidden />
                    </span>
                    <span className="font-display rounded-full bg-muted px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      {p.surface}
                    </span>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-ink">{fullName(person)}</p>
                    <p className="text-sm font-semibold text-green-text">{p.label}</p>
                  </div>
                  <p className="text-base leading-snug text-ink-soft">{p.blurb}</p>
                  <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    {slot && (
                      <span className="inline-flex items-center gap-1.5">
                        <ClipboardList className="size-4" aria-hidden />
                        {person.regularSlots.length} regular {person.regularSlots.length === 1 ? "slot" : "slots"}
                      </span>
                    )}
                    {person.role !== "ADMIN" && (
                      <span className={cn("inline-flex items-center gap-1.5", summary.overdue > 0 && "text-status-bad", summary.notStarted > 0 && summary.overdue === 0 && "text-status-neutral")}>
                        {summary.overdue > 0 || summary.notStarted > 0 ? (
                          <AlertTriangle className="size-4" aria-hidden />
                        ) : (
                          <ShieldCheck className="size-4" aria-hidden />
                        )}
                        {summary.overdue > 0
                          ? `${summary.overdue} overdue`
                          : summary.notStarted > 0
                            ? `${summary.notStarted} modules to complete`
                            : summary.dueSoon > 0
                              ? `${summary.dueSoon} due soon`
                              : "Training current"}
                      </span>
                    )}
                  </div>
                </button>
              </form>
            );
          })}
        </div>
        <p className="mt-8 text-sm text-muted-foreground">
          Switching persona sets a cookie. There is no real authentication in this demo; the production build uses email sign-in with passkeys, the same as the Fair Food portal.
        </p>
      </div>
    </main>
  );
}
