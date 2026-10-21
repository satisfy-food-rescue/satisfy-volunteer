import Link from "next/link";
import { AlertTriangle, ClipboardList, ShieldCheck, Sprout, Truck, Warehouse, type LucideIcon } from "lucide-react";
import { BrandFooter, FoodIcon, Logo } from "@/components/brand/logo";
import { Photo } from "@/components/shared/photo";
import { LegalLinks } from "@/components/auth/auth-shell";
import { db } from "@/lib/db";
import { todayISO, formatDayLong } from "@/lib/dates";
import { fullName } from "@/lib/domain";
import { moduleStatuses, trainingSummary } from "@/lib/training";
import { IMPACT, compactCount, formatCount } from "@/lib/brand";
import { PERSONAS, type PersonaKey } from "@/lib/personas";
import { signInAsPersona } from "@/app/sign-in/actions";
import { cn } from "@/lib/utils";

const PERSONA_ICON: Record<PersonaKey, LucideIcon> = {
  phillipa: ShieldCheck,
  margaret: Warehouse,
  tony: Truck,
  jess: Sprout,
};

/** DEMO_MODE sign-in: pick a persona, no password. */
export async function DemoPersonas() {
  const today = todayISO();
  const [people, modules] = await Promise.all([
    db.volunteer.findMany({
      where: { email: { in: PERSONAS.map((p) => p.email) } },
      include: { trainingRecords: true, regularSlots: { include: { template: true } } },
    }),
    db.trainingModule.findMany(),
  ]);
  const byEmail = new Map(people.map((p) => [p.email, p]));

  return (
    <main id="main" className="flex flex-1 flex-col">
      <div className="bg-teal text-white">
        <div className="mx-auto grid w-full max-w-5xl gap-8 px-5 py-10 md:grid-cols-[1fr_19rem] md:items-center md:gap-12 md:px-10 md:py-14">
          <div>
            <Logo tone="white" className="h-28 md:h-32" />
            <h1 className="mt-8 max-w-xl text-4xl text-white md:text-5xl">
              Volunteer roster, training and cover in one place.
            </h1>
            <p className="mt-3 max-w-xl text-lg text-white/85">
              Demo build for Satisfy Food Rescue. Pick a persona to explore. Nothing here sends real email or touches Infoodle.
            </p>
            {/* A row each where it is narrow (a phone, or beside the photo on a
                tablet), with the label beside the number or, when it does not
                fit, under it. Three cards where there is room. */}
            <div className="@container mt-8 max-w-xl">
              <dl className="grid gap-2 @lg:grid-cols-3 @lg:gap-3">
                {(
                  [
                    ["broccoli", compactCount(IMPACT.kgRescued), "kg of kai rescued"],
                    ["carrot", compactCount(IMPACT.meals), "meals shared"],
                    ["apple", `${formatCount(IMPACT.co2Tonnes)} t`, `CO₂e avoided in ${IMPACT.co2Period}`],
                  ] as const
                ).map(([icon, n, l]) => (
                  <div key={l} className="relative flex flex-wrap items-baseline gap-x-2 rounded-2xl bg-white/10 py-3 pl-16 pr-4 ring-1 ring-white/15 @lg:flex-col @lg:flex-nowrap @lg:items-start @lg:gap-0.5 @lg:px-3 @lg:py-3.5">
                    <dt className="order-last text-base font-semibold leading-snug text-white/80 @lg:text-xs">{l}</dt>
                    <dd className="@lg:flex @lg:flex-col @lg:items-start @lg:gap-3">
                      <FoodIcon kind={icon} className="absolute left-4 top-1/2 size-8 -translate-y-1/2 rounded-full ring-2 ring-white/80 @lg:static @lg:translate-y-0" />
                      <span className="whitespace-nowrap font-display text-xl font-bold text-white tabular @lg:text-2xl">{n}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
          <Photo
            photo="team"
            sizes="(min-width: 48rem) 19rem, calc(100vw - 2.5rem)"
            preload
            className="aspect-[2/1] rounded-3xl ring-1 ring-white/15 md:aspect-[3/4]"
          />
        </div>
      </div>

      <div className="mx-auto w-full max-w-5xl px-5 py-10 md:px-10">
        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-2xl text-ink">Sign in as</h2>
          <p className="text-muted-foreground">
            Demo date: {formatDayLong(today)}. Seed data is generated relative to today.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {PERSONAS.map((p) => {
            const person = byEmail.get(p.email);
            if (!person) return null;
            const summary = trainingSummary(moduleStatuses(person, modules, person.trainingRecords, today));
            const slot = person.regularSlots[0];
            const Icon = PERSONA_ICON[p.key];
            return (
              <form key={p.key} action={signInAsPersona} className="flex">
                <input type="hidden" name="persona" value={p.key} />
                <button
                  type="submit"
                  className={cn(
                    "group flex w-full cursor-pointer flex-col gap-3 rounded-2xl border border-border bg-card p-5 text-left shadow-sm transition-all",
                    "hover:-translate-y-0.5 hover:border-teal/60 hover:shadow-md active:translate-y-0",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex size-12 items-center justify-center rounded-full bg-teal-tint text-teal transition-colors group-hover:bg-teal group-hover:text-white">
                      <Icon className="size-6" aria-hidden />
                    </span>
                    <span className="font-display rounded-full bg-muted px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      {p.surface}
                    </span>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-ink">{fullName(person)}</p>
                    <p className="text-sm font-semibold text-teal">{p.label}</p>
                  </div>
                  <p className="text-base leading-snug text-ink-soft">{p.blurb}</p>
                  {(slot || person.role !== "ADMIN") && (
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
                  )}
                </button>
              </form>
            );
          })}
        </div>
        <p className="mt-8 text-muted-foreground">
          Picking a persona signs you straight in. Real volunteers sign in with a password, Google, Apple or a passkey. New volunteers{" "}
          <Link href="/sign-up" className="font-semibold text-teal underline underline-offset-4">sign up to volunteer</Link>, and their application lands in Phillipa&apos;s Applications.
        </p>
        <LegalLinks className="mt-8 justify-start" />
      </div>
      <BrandFooter className="mt-auto pb-6" />
    </main>
  );
}
