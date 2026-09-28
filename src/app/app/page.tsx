import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarDays, CalendarOff, GraduationCap, HandHelping, MapPin, Sprout } from "lucide-react";
import { requireVolunteer } from "@/lib/session";
import { addDays, formatDay, formatTimeRange, relativeDays, todayISO, formatDayLong } from "@/lib/dates";
import { gapsBetween } from "@/lib/roster";
import { myUpcomingShifts, trainingContext } from "@/lib/volunteer-data";
import { IMPACT, compactCount, formatCount } from "@/lib/brand";
import { AvatarBadge } from "@/components/shared/avatar-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { db } from "@/lib/db";
import { isoToDate } from "@/lib/dates";

export const metadata = { title: "Home" };

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("en-NZ", { timeZone: "Pacific/Auckland", hour: "numeric", hourCycle: "h23" }).format(new Date()));
  return hour < 12 ? "Mōrena" : hour < 17 ? "Kia ora" : "Kia ora";
}

export default async function HomePage() {
  const me = await requireVolunteer();
  const today = todayISO();
  const [upcoming, training, gaps, callouts] = await Promise.all([
    myUpcomingShifts(me.id, today),
    trainingContext(me, today),
    gapsBetween(today, addDays(today, 28)),
    me.inHarvestPool
      ? db.harvestCallout.findMany({ where: { date: { gte: isoToDate(today) } }, include: { rsvps: { where: { volunteerId: me.id } } }, orderBy: { date: "asc" }, take: 1 })
      : Promise.resolve([]),
  ]);
  const next = upcoming[0];
  const others = next ? next.confirmed.filter((a) => a.volunteerId !== me.id) : [];
  const s = training.summary;
  const coverable = gaps.filter((g) => !g.released.some((r) => r.volunteerId === me.id));
  const alert =
    s.overdue > 0
      ? { tone: "bad" as const, title: `${s.overdue} training ${s.overdue === 1 ? "refresher is" : "refreshers are"} overdue`, text: "Route shifts are blocked until it is done. Most refreshers take ten minutes online.", icon: AlertTriangle }
      : s.notStarted > 0
        ? { tone: "info" as const, title: "Complete your induction to start booking shifts", text: "Book into the next Induction and Health & Safety session, then tick off the online modules.", icon: GraduationCap }
        : s.dueSoon > 0
          ? { tone: "warn" as const, title: `${s.dueSoon} refresher${s.dueSoon === 1 ? "" : "s"} due soon`, text: "Get ahead of it now and nothing will get blocked.", icon: AlertTriangle }
          : null;

  return (
    <div className="flex flex-col gap-6 px-5 pb-6 pt-5">
      <section>
        <p className="eyebrow">{formatDayLong(today)}</p>
        <h1 className="mt-1 text-[2.1rem] leading-tight text-ink">
          {greeting()}, {me.firstName}.
        </h1>
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
          <alert.icon className="mt-0.5 size-6 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block font-bold">{alert.title}</span>
            <span className="mt-0.5 block text-sm leading-snug opacity-90">{alert.text}</span>
          </span>
          <ArrowRight className="mt-1 size-5 shrink-0" aria-hidden />
        </Link>
      )}

      <section aria-labelledby="next-shift">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 id="next-shift" className="text-xl text-ink">Next shift</h2>
          <Link href="/app/shifts" className="text-sm font-semibold text-green-text hover:underline">All shifts</Link>
        </div>
        {next ? (
          <Link href={`/app/shifts/${next.shift.id}`} className="pattern-wheat block rounded-2xl border border-green/40 bg-green-tint-soft p-5 shadow-sm transition-colors hover:border-green">
            <p className="text-sm font-bold uppercase tracking-wide text-green-text">{relativeDays(next.iso, today)}</p>
            <p className="mt-1 font-display text-3xl text-ink">{formatDay(next.iso)}</p>
            <p className="mt-1 text-lg text-ink tabular">{formatTimeRange(next.shift.startTime, next.shift.endTime)}</p>
            <p className="mt-3 font-bold text-ink">{next.shift.template.name}</p>
            <p className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-ink-soft">
              <MapPin className="size-4" aria-hidden />
              {next.location}
            </p>
            {others.length > 0 && (
              <div className="mt-4 flex items-center gap-2">
                <span className="flex -space-x-2">
                  {others.slice(0, 5).map((a) => (
                    <AvatarBadge key={a.id} person={a.volunteer} size="sm" className="ring-2 ring-green-tint-soft" />
                  ))}
                </span>
                <span className="text-sm text-ink-soft">
                  with {others.slice(0, 2).map((a) => a.volunteer.firstName).join(", ")}
                  {others.length > 2 ? ` and ${others.length - 2} more` : ""}
                </span>
              </div>
            )}
          </Link>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-card p-5">
            <p className="font-bold text-ink">No shifts booked yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {s.notStarted > 0 ? "Once your induction is done, you can pick a regular weekly slot or book one-off shifts." : "Browse the week and book a morning that suits."}
            </p>
            <Button className="mt-4 h-12 w-full text-base" render={<Link href={s.notStarted > 0 ? "/app/training" : "/app/shifts"} />}>
              {s.notStarted > 0 ? "Book my induction" : "Find a shift"}
            </Button>
          </div>
        )}
      </section>

      <section aria-label="Quick actions" className="grid grid-cols-3 gap-2">
        {[
          { href: "/app/shifts", label: "Book a shift", icon: CalendarDays },
          { href: "/app/slot", label: "Mark me away", icon: CalendarOff },
          { href: "/app/training", label: "My training", icon: GraduationCap },
        ].map((q) => (
          <Link
            key={q.href}
            href={q.href}
            className="flex min-h-[5.5rem] flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card px-2 py-3 text-center text-sm font-bold leading-tight text-ink shadow-sm transition-colors hover:border-green hover:bg-green-tint-soft"
          >
            <q.icon className="size-6 text-green-text" aria-hidden />
            {q.label}
          </Link>
        ))}
      </section>

      {coverable.length > 0 && (
        <Link href="/app/gaps" className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-magenta/50">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-magenta-tint text-magenta">
            <HandHelping className="size-6" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-bold text-ink">
              {coverable.length} {coverable.length === 1 ? "shift needs" : "shifts need"} cover
            </span>
            <span className="block text-sm text-muted-foreground">
              Next: {formatDay(coverable[0].iso)}, {coverable[0].shift.template.name}
            </span>
          </span>
          <ArrowRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        </Link>
      )}

      {callouts[0] && (
        <Link href="/app/harvest" className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-green">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-green-tint text-green-deep">
            <Sprout className="size-6" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-bold text-ink">Harvest callout: {callouts[0].title}</span>
            <span className="block text-sm text-muted-foreground">
              {formatDay(callouts[0].date.toISOString().slice(0, 10))}
              {callouts[0].rsvps[0]?.status === "GOING" ? " · You're going" : " · Tap to respond"}
            </span>
          </span>
          <ArrowRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        </Link>
      )}

      <section aria-label="Impact" className="rounded-2xl bg-green-deep p-5 text-white">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-green">Together, over {IMPACT.yearsRunning} years</p>
        <dl className="mt-3 grid grid-cols-3 gap-3">
          {[
            [compactCount(IMPACT.kgRescued), "kg of kai rescued"],
            [compactCount(IMPACT.meals), "meals shared"],
            [`${formatCount(IMPACT.co2Tonnes)} t`, `CO2e avoided in ${IMPACT.co2Period}`],
          ].map(([n, l]) => (
            <div key={l}>
              <dd className="font-display text-2xl text-white tabular">{n}</dd>
              <dt className="mt-0.5 text-xs leading-snug text-white/75">{l}</dt>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
