import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarDays, CalendarOff, GraduationCap, HandHelping, MapPin } from "lucide-react";
import { requireVolunteer } from "@/lib/session";
import { formatDay, formatTimeRange, relativeDays, todayISO, formatDayLong } from "@/lib/dates";
import { loadHome } from "@/lib/home";
import { IMPACT, compactCount, formatCount } from "@/lib/brand";
import { AvatarBadge } from "@/components/shared/avatar-badge";
import { FoodIcon } from "@/components/brand/logo";
import { ShiftKindIcon } from "@/components/app/shift-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Home" };

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("en-NZ", { timeZone: "Pacific/Auckland", hour: "numeric", hourCycle: "h23" }).format(new Date()));
  return hour < 12 ? "Mōrena" : hour < 17 ? "Kia ora" : "Kia ora";
}

export default async function HomePage() {
  const me = await requireVolunteer();
  const today = todayISO();
  const { next, coverable, callout, alert, empty } = await loadHome(me, today);
  const others = next ? next.confirmed.filter((a) => a.volunteerId !== me.id) : [];
  const AlertIcon = alert?.tone === "info" ? GraduationCap : AlertTriangle;

  return (
    <div className="flex flex-col pb-2">
      <section className="bg-teal px-5 pb-16 pt-2 text-white">
        <p className="font-display text-xs font-bold uppercase tracking-[0.14em] text-teal-on">{formatDayLong(today)}</p>
        <h1 className="mt-1.5 text-[2.1rem] leading-tight text-white">
          {greeting()}, {me.firstName}.
        </h1>
      </section>

      <div className="-mt-11 flex flex-col gap-6 px-5">
        <section aria-labelledby="next-shift">
          {next ? (
            <Link
              href={`/app/shifts/${next.shift.id}`}
              className="group block overflow-hidden rounded-2xl bg-card shadow-[0_12px_32px_-16px_rgb(16_48_58/0.45)] ring-1 ring-border transition-shadow hover:ring-teal/50"
            >
              <span className="flex items-start justify-between gap-3 p-5">
                <span className="min-w-0">
                  <span id="next-shift" className="eyebrow block">Next shift · {relativeDays(next.iso, today)}</span>
                  <span className="mt-1.5 block font-display text-3xl font-bold text-ink">{formatDay(next.iso)}</span>
                  <span className="mt-0.5 block text-lg text-ink-soft tabular">{formatTimeRange(next.shift.startTime, next.shift.endTime)}</span>
                </span>
                <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-2xl", next.kind === "WAREHOUSE" ? "bg-green-tint text-green-deep" : "bg-sky-tint text-sky-text")}>
                  <ShiftKindIcon kind={next.kind} className="size-6" />
                </span>
              </span>
              <span className="block border-t border-border bg-teal-tint-soft px-5 py-4">
                <span className="flex items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block font-bold text-ink">{next.shift.template.name}</span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-soft">
                      <MapPin className="size-4 shrink-0 text-sky" aria-hidden />
                      {next.location}
                    </span>
                  </span>
                  <ArrowRight className="size-5 shrink-0 text-teal transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
                {others.length > 0 && (
                  <span className="mt-3 flex items-center gap-2">
                    <span className="flex -space-x-1.5">
                      {others.slice(0, 5).map((a) => (
                        <AvatarBadge key={a.id} person={a.volunteer} size="sm" className="ring-2 ring-teal-tint-soft" />
                      ))}
                    </span>
                    <span className="text-sm text-ink-soft">
                      with {others.slice(0, 2).map((a) => a.volunteer.firstName).join(", ")}
                      {others.length > 2 ? ` and ${others.length - 2} more` : ""}
                    </span>
                  </span>
                )}
              </span>
            </Link>
          ) : (
            <div className="rounded-2xl bg-card p-5 shadow-[0_12px_32px_-16px_rgb(16_48_58/0.45)] ring-1 ring-border">
              <p id="next-shift" className="eyebrow">Next shift</p>
              <p className="mt-1.5 text-xl font-bold text-ink">No shifts booked yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {empty.text}
              </p>
              <Button className="mt-4 h-12 w-full text-base" render={<Link href={empty.target === "training" ? "/app/training" : "/app/shifts"} />}>
                {empty.cta}
              </Button>
            </div>
          )}
        </section>

        {alert && (
          <Link
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
        )}

        <section aria-label="Quick actions" className="grid grid-cols-3 gap-2.5">
          {[
            { href: "/app/shifts", label: "Book a shift", icon: CalendarDays },
            { href: "/app/slot", label: "Mark me away", icon: CalendarOff },
            { href: "/app/training", label: "My training", icon: GraduationCap },
          ].map((q) => (
            <Link
              key={q.href}
              href={q.href}
              className="group flex min-h-[6.25rem] flex-col items-center justify-start gap-2.5 rounded-2xl border border-border bg-card px-2 pb-3 pt-4 text-center text-sm font-bold leading-tight text-ink shadow-sm transition-colors hover:border-teal/60"
            >
              <span className="flex size-11 items-center justify-center rounded-full bg-teal-tint text-teal transition-colors group-hover:bg-teal group-hover:text-white">
                <q.icon className="size-5" aria-hidden />
              </span>
              {q.label}
            </Link>
          ))}
        </section>

        {coverable.length > 0 && (
          <Link href="/app/gaps" className="flex items-center gap-3 rounded-2xl border border-orange/60 bg-card p-4 shadow-sm transition-colors hover:border-orange">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-orange text-ink">
              <HandHelping className="size-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold text-ink">
                {coverable.length} {coverable.length === 1 ? "shift needs" : "shifts need"} cover
              </span>
              <span className="block text-sm text-muted-foreground">
                Next: {formatDay(coverable[0].iso)}, {coverable[0].shift.template.name}
              </span>
            </span>
            <ArrowRight className="size-5 shrink-0 text-orange-text" aria-hidden />
          </Link>
        )}

        {callout && (
          <Link href="/app/harvest" className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-teal/60">
            <FoodIcon kind="apple" className="size-11" />
            <span className="min-w-0 flex-1">
              <span className="block font-bold text-ink">Harvest callout: {callout.title}</span>
              <span className="block text-sm text-muted-foreground">
                {formatDay(callout.date.toISOString().slice(0, 10))}
                {callout.rsvps[0]?.status === "GOING" ? " · You're going" : " · Tap to respond"}
              </span>
            </span>
            <ArrowRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        )}

        <section aria-label="Impact" className="rounded-2xl bg-teal p-5 text-white">
          <p className="font-display text-xs font-bold uppercase tracking-[0.14em] text-teal-on">Together, over {IMPACT.yearsRunning} years</p>
          <dl className="mt-4 grid grid-cols-3 gap-3">
            {(
              [
                ["broccoli", compactCount(IMPACT.kgRescued), "kg of kai rescued"],
                ["carrot", compactCount(IMPACT.meals), "meals shared"],
                ["apple", `${formatCount(IMPACT.co2Tonnes)} t`, `CO2e avoided in ${IMPACT.co2Period}`],
              ] as const
            ).map(([icon, n, l]) => (
              <div key={l} className="flex flex-col">
                <FoodIcon kind={icon} className="size-9 rounded-full ring-2 ring-white/80" />
                <dd className="mt-2.5 font-display text-2xl font-bold text-white tabular">{n}</dd>
                <dt className="mt-0.5 text-xs leading-snug text-white/80">{l}</dt>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  );
}
