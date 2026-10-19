import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarOff, ChevronRight, GraduationCap, HandHelping, MapPin, Repeat } from "lucide-react";
import { requireVolunteer } from "@/lib/session";
import { WEEKDAY_SHORT, formatDay, formatTimeRange, isoToDate, relativeDays, todayISO, formatDayLong, weekdayOf } from "@/lib/dates";
import { loadHome } from "@/lib/home";
import { IMPACT, compactCount, formatCount } from "@/lib/brand";
import type { ShiftView } from "@/lib/roster";
import { AvatarBadge } from "@/components/shared/avatar-badge";
import { Chip } from "@/components/shared/status-chip";
import { kindTileClass } from "@/components/app/shift-card";
import { FoodIcon } from "@/components/brand/logo";
import { Photo, shiftPhoto } from "@/components/shared/photo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Home" };

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("en-NZ", { timeZone: "Pacific/Auckland", hour: "numeric", hourCycle: "h23" }).format(new Date()));
  return hour < 12 ? "Mōrena" : "Kia ora";
}

// The hero is one grid from edge to edge of <main>: gutter, content, gutter.
// The teal band is a grid item in the first row that hangs below it by a
// negative margin, so whatever sits in the second row (the next shift and,
// on wider screens, its photo) overlaps the band's lower edge by the same
// amount however tall the greeting wraps. Its content columns line up with
// AppPage below.
const HERO_GRID =
  "grid grid-cols-[1.25rem_minmax(0,1fr)_1.25rem] @3xl/app:grid-cols-[minmax(0.5rem,1fr)_repeat(12,minmax(0,5.5rem))_minmax(0.5rem,1fr)] @3xl/app:gap-x-6 @6xl/app:grid-cols-[minmax(1.5rem,1fr)_repeat(12,minmax(0,5.5rem))_minmax(1.5rem,1fr)]";
/** The hero's content, across both layouts. */
const CONTENT = "col-start-2 col-end-3 @3xl/app:col-end-14";

/** One row of the home agenda: the shifts booked after the next one. */
function AgendaRow({ view, meId }: { view: ShiftView; meId: string }) {
  const mine = view.confirmed.find((a) => a.volunteerId === meId);
  return (
    <li>
      <Link href={`/app/shifts/${view.shift.id}`} className="group flex items-center gap-4 px-4 py-3 transition-colors hover:bg-muted @3xl/app:px-5 @3xl/app:py-4">
        <span className={cn("flex size-14 shrink-0 flex-col items-center justify-center rounded-xl leading-none", kindTileClass(view.kind))}>
          <span className="text-xs font-bold uppercase">{WEEKDAY_SHORT[weekdayOf(view.iso)]}</span>
          <span className="mt-1 font-display text-2xl font-bold tabular">{isoToDate(view.iso).getUTCDate()}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold leading-snug text-ink">{view.name}</span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground tabular">
            {formatTimeRange(view.shift.startTime, view.shift.endTime)}
            <span className="hidden items-center gap-1 @3xl/app:inline-flex">
              <MapPin className="size-3.5 text-sky" aria-hidden />
              {view.location}
            </span>
            {mine?.source === "REGULAR" && <Chip tone="neutral" icon={Repeat} size="sm">Regular</Chip>}
            {mine?.source === "COVER" && <Chip tone="warn" icon={HandHelping} size="sm">Covering</Chip>}
          </span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
      </Link>
    </li>
  );
}

export default async function HomePage() {
  const me = await requireVolunteer();
  const today = todayISO();
  const { next, later, year, coverable, harvest, alert, empty } = await loadHome(me, today);
  const others = next ? next.confirmed.filter((a) => a.volunteerId !== me.id) : [];
  const AlertIcon = alert?.tone === "info" ? GraduationCap : AlertTriangle;
  const heroPhoto = next ? shiftPhoto(next.kind) : "team";
  // Things that want the volunteer's attention, beside the agenda on wide screens.
  const prompts = [
    alert && (
      <Link
        key="alert"
        href="/app/training"
        className={cn(
          "flex items-start gap-3 rounded-2xl p-4 ring-1 transition-colors",
          alert.tone === "bad" && "bg-status-bad-bg text-status-bad ring-status-bad/20 hover:ring-status-bad/40",
          alert.tone === "warn" && "bg-status-warn-bg text-status-warn ring-status-warn/20 hover:ring-status-warn/40",
          alert.tone === "info" && "bg-status-info-bg text-status-info ring-status-info/20 hover:ring-status-info/40",
        )}
      >
        <AlertIcon className="mt-0.5 size-6 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block font-bold">{alert.title}</span>
          <span className="mt-0.5 block text-sm leading-snug opacity-90">{alert.text}</span>
        </span>
        <ArrowRight className="mt-1 size-5 shrink-0" aria-hidden />
      </Link>
    ),
    coverable.length > 0 && (
      <Link key="cover" href="/app/gaps" className="flex items-center gap-3 rounded-2xl border border-orange/60 bg-card p-4 shadow-sm transition-colors hover:border-orange">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-orange text-ink">
          <HandHelping className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold text-ink">
            {coverable.length} {coverable.length === 1 ? "shift needs" : "shifts need"} cover
          </span>
          <span className="block text-sm text-muted-foreground">
            Next: {formatDay(coverable[0].iso)}, {coverable[0].name}
          </span>
        </span>
        <ArrowRight className="size-5 shrink-0 text-orange-text" aria-hidden />
      </Link>
    ),
    harvest && (
      <Link key="harvest" href={`/app/shifts/${harvest.shift.id}`} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-teal/60">
        <FoodIcon kind="apple" className="size-11" />
        <span className="min-w-0 flex-1">
          <span className="block font-bold text-ink">Harvest: {harvest.name}</span>
          <span className="block text-sm text-muted-foreground">
            {formatDay(harvest.iso)}
            {harvest.confirmed.some((a) => a.volunteerId === me.id) ? " · You're going" : " · Tap to sign up"}
          </span>
        </span>
        <ArrowRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    ),
  ].filter(Boolean);

  return (
    <div className="flex flex-col pb-2">
      <div className={HERO_GRID}>
        <div aria-hidden className="col-span-full row-start-1 -mb-11 bg-teal @3xl/app:-mb-28" />

        <section className={cn(CONTENT, "relative row-start-1 pb-5 pt-2 text-white @3xl/app:col-end-9 @3xl/app:pb-10 @3xl/app:pt-12 @6xl/app:pt-16")}>
          <p className="font-display text-xs font-bold uppercase tracking-[0.14em] text-teal-on @3xl/app:text-sm">{formatDayLong(today)}</p>
          <h1 className="mt-1.5 text-[2.1rem] leading-tight text-white @3xl/app:mt-3 @3xl/app:text-5xl @3xl/app:leading-[1.02] @5xl/app:text-6xl @6xl/app:text-7xl">
            {greeting()}, <span className="whitespace-nowrap">{me.firstName}.</span>
          </h1>
        </section>

        {/* On wider screens the next shift's photo stands beside the greeting
            and drops past the band, with the brand's food icons on its corner. */}
        <div className="relative col-start-9 col-end-14 row-span-2 row-start-1 hidden pt-12 @3xl/app:block @6xl/app:pt-16">
          <Photo photo={heroPhoto} sizes="(min-width: 48rem) 36vw, 1px" decorative preload className="h-full min-h-[22rem] rounded-3xl shadow-raised" />
          <span className="absolute -bottom-4 -left-4 flex gap-1.5 rounded-full bg-background p-1.5">
            <FoodIcon kind="broccoli" className="size-10" />
            <FoodIcon kind="carrot" className="size-10" />
            <FoodIcon kind="apple" className="size-10" />
          </span>
        </div>

        <section aria-labelledby="next-shift" className={cn(CONTENT, "relative row-start-2 @3xl/app:col-end-9")}>
          {next ? (
            <Link
              href={`/app/shifts/${next.shift.id}`}
              className="group block overflow-hidden rounded-2xl bg-card shadow-raised transition-shadow hover:ring-2 hover:ring-teal/50 @3xl/app:rounded-3xl"
            >
              <Photo photo={shiftPhoto(next.kind)} sizes="(min-width: 48rem) 1px, calc(100vw - 2.5rem)" decorative preload className="h-36 @3xl/app:hidden" />
              <span className="block p-5 @3xl/app:p-8">
                <span id="next-shift" className="eyebrow block">Next shift · {relativeDays(next.iso, today)}</span>
                <span className="mt-1.5 block font-display text-3xl font-bold text-ink @3xl/app:mt-3 @3xl/app:text-5xl @6xl/app:text-6xl">{formatDay(next.iso)}</span>
                <span className="mt-0.5 block text-lg text-ink-soft tabular @3xl/app:mt-2 @3xl/app:text-2xl">{formatTimeRange(next.shift.startTime, next.shift.endTime)}</span>
              </span>
              <span className="block border-t border-border bg-teal-tint-soft px-5 py-4 @3xl/app:px-8 @3xl/app:py-5">
                <span className="flex items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block font-bold text-ink @3xl/app:text-lg">{next.name}</span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-soft @3xl/app:text-base">
                      <MapPin className="size-4 shrink-0 text-sky" aria-hidden />
                      {next.location}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center justify-center rounded-full text-teal transition-colors @3xl/app:size-12 @3xl/app:bg-teal @3xl/app:text-white @3xl/app:group-hover:bg-teal-deep">
                    <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </span>
                </span>
                {others.length > 0 && (
                  <span className="mt-3 flex items-center gap-2">
                    <span className="flex -space-x-1">
                      {others.slice(0, 5).map((a) => (
                        <AvatarBadge key={a.id} person={a.volunteer} size="sm" className="ring-2 ring-card" />
                      ))}
                    </span>
                    <span className="text-sm text-ink-soft">
                      with {others.slice(0, 2).map((a) => a.volunteer.firstName).join(", ")}
                      {others.length > 2 ? ` and ${others.length - 2} more` : ""}
                    </span>
                  </span>
                )}
              </span>
            </Link>
          ) : (
            <div className="rounded-2xl bg-card p-5 shadow-raised ring-1 ring-border @3xl/app:rounded-3xl @3xl/app:p-8">
              <p id="next-shift" className="eyebrow">Next shift</p>
              <p className="mt-1.5 text-xl font-bold text-ink @3xl/app:mt-3 @3xl/app:text-3xl">No shifts booked yet</p>
              <p className="mt-1 text-sm text-muted-foreground @3xl/app:mt-2 @3xl/app:text-base">
                {empty.text}
              </p>
              <Button className="mt-4 h-12 w-full text-base @3xl/app:mt-6 @3xl/app:w-auto @3xl/app:px-6" render={<Link href={empty.target === "training" ? "/app/training" : "/app/shifts"} />}>
                {empty.cta}
              </Button>
            </div>
          )}
        </section>
      </div>

      <div className="mx-auto mt-6 flex w-full max-w-[88.5rem] flex-col gap-6 px-5 @3xl/app:mt-14 @3xl/app:gap-10 @3xl/app:px-8 @6xl/app:px-12">
        <div className={cn("grid gap-6 @3xl/app:gap-x-6", next && prompts.length > 0 && "@5xl/app:grid-cols-12")}>
          {/* On a phone the alert leads, the agenda follows, then the rest. */}
          {next && (
            <section aria-labelledby="later-h" className="order-2 @5xl/app:order-none @5xl/app:col-span-8">
              <h2 id="later-h" className="mb-2.5 text-xl text-ink @3xl/app:mb-4 @3xl/app:text-2xl">
                {later.length > 0 ? "After that" : "Your shifts"}
              </h2>
              <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                {later.map((view) => (
                  <AgendaRow key={view.shift.id} view={view} meId={me.id} />
                ))}
                <li>
                  <Link href="/app/slot" className="group flex items-center gap-4 px-4 py-3 text-teal transition-colors hover:bg-teal-tint-soft @3xl/app:px-5 @3xl/app:py-4">
                    <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-teal-tint">
                      <CalendarOff className="size-6" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold">Can&apos;t make one? Mark me away</span>
                      <span className="block text-sm text-muted-foreground">Your shifts go to someone who can cover.</span>
                    </span>
                    <ChevronRight className="size-5 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </Link>
                </li>
              </ul>
            </section>
          )}
          {prompts.length > 0 && (
            <section
              aria-label="Needs you"
              className={cn(
                "contents",
                next ? "@5xl/app:col-span-4 @5xl/app:flex @5xl/app:flex-col @5xl/app:gap-4 @5xl/app:pt-12" : "@3xl/app:grid @3xl/app:grid-cols-[repeat(auto-fit,minmax(18rem,1fr))] @3xl/app:gap-4",
              )}
            >
              {prompts.map((p, i) => (
                // The alert comes before the agenda on a phone, the others after.
                <div key={i} className={cn("[&>a]:h-full", i === 0 && alert ? "order-1 @5xl/app:order-none" : "order-3 @5xl/app:order-none")}>{p}</div>
              ))}
            </section>
          )}
        </div>

        <section aria-labelledby="mahi-h" className="overflow-hidden rounded-3xl bg-teal text-white @5xl/app:grid @5xl/app:grid-cols-12">
          <div className="p-5 pb-6 @3xl/app:p-10 @5xl/app:col-span-7">
            <h2 id="mahi-h" className="font-display text-xs font-bold uppercase tracking-[0.14em] text-teal-on @3xl/app:text-sm">Your mahi, past 12 months</h2>
            {year.shifts > 0 ? (
              <>
                <p className="mt-3 flex items-end gap-5 @3xl/app:mt-6 @3xl/app:gap-12">
                  <span className="flex flex-col">
                    <span className="font-display text-6xl font-bold leading-none tabular @3xl/app:text-8xl">{year.hours}</span>
                    <span className="mt-1.5 text-sm font-semibold text-white/85 @3xl/app:mt-3 @3xl/app:text-base">hours given</span>
                  </span>
                  <span className="flex flex-col">
                    <span className="font-display text-6xl font-bold leading-none text-teal-on tabular @3xl/app:text-8xl">{year.shifts}</span>
                    <span className="mt-1.5 text-sm font-semibold text-white/85 @3xl/app:mt-3 @3xl/app:text-base">{year.shifts === 1 ? "shift" : "shifts"}</span>
                  </span>
                </p>
                <p className="mt-4 text-white/90 @3xl/app:mt-6 @3xl/app:max-w-md @3xl/app:text-lg">Ngā mihi nui, {me.firstName}. Every one of those mornings put kai on someone&apos;s table.</p>
              </>
            ) : (
              <p className="mt-3 text-lg text-white/90 @3xl/app:max-w-md @3xl/app:text-xl">Your hours show up here after your first shift. Ngā mihi for joining us.</p>
            )}
          </div>
          <div className="border-t border-white/15 bg-teal-deep/40 p-5 @3xl/app:p-10 @5xl/app:col-span-5 @5xl/app:flex @5xl/app:flex-col @5xl/app:justify-center @5xl/app:border-l @5xl/app:border-t-0">
            <p className="font-display text-xs font-bold uppercase tracking-[0.14em] text-teal-on @3xl/app:text-sm">Together, over {IMPACT.yearsRunning} years</p>
            <ul className="mt-3 grid grid-cols-3 gap-3 @3xl/app:mt-6 @3xl/app:gap-6 @5xl/app:grid-cols-1 @5xl/app:gap-5">
              {(
                [
                  ["broccoli", compactCount(IMPACT.kgRescued), "kg of kai rescued"],
                  ["carrot", compactCount(IMPACT.meals), "meals shared"],
                  ["apple", `${formatCount(IMPACT.co2Tonnes)} t`, `CO2e avoided in ${IMPACT.co2Period}`],
                ] as const
              ).map(([icon, n, l]) => (
                <li key={l} className="flex flex-col @5xl/app:flex-row @5xl/app:items-center @5xl/app:gap-4">
                  <FoodIcon kind={icon} className="size-8 rounded-full ring-2 ring-white/80 @3xl/app:size-11" />
                  <span className="@5xl/app:flex @5xl/app:items-baseline @5xl/app:gap-3">
                    <span className="mt-2 block font-display text-xl font-bold text-white tabular @3xl/app:mt-3 @3xl/app:text-3xl @5xl/app:mt-0">{n}</span>
                    <span className="mt-0.5 block text-xs leading-snug text-white/85 @3xl/app:text-base @5xl/app:mt-0">{l}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
