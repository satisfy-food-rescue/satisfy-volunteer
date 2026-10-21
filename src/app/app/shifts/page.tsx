import Link from "next/link";
import { CalendarOff, ChevronDown, ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { requireVolunteer } from "@/lib/session";
import { addDays, formatDayShort, isWeekday, todayISO, weekMonday, workWeek, WEEKDAY_LONG, weekdayOf, isoToDate, formatMonth } from "@/lib/dates";
import { shiftsBetween, type ShiftView } from "@/lib/roster";
import { trainingContext } from "@/lib/volunteer-data";
import { eligibilityFor } from "@/lib/training";
import { LockedShiftCard, ShiftCard } from "@/components/app/shift-card";
import { LockBanner } from "@/components/app/lock-banner";
import { AppPage, AppPageHeader } from "@/components/app/app-page-header";
import { Chip } from "@/components/shared/status-chip";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import { db } from "@/lib/db";

export const metadata = { title: "Shifts" };

export default async function ShiftsPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const me = await requireVolunteer();
  const today = todayISO();
  const { week } = await searchParams;
  // At the weekend the week worth showing is the coming one.
  const monday = weekMonday(week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? week : isWeekday(today) ? today : addDays(today, 2));
  const days = workWeek(monday);
  const [shifts, training, absences] = await Promise.all([
    shiftsBetween(days[0], days[4]),
    trainingContext(me, today),
    db.absence.findMany({ where: { volunteerId: me.id, startDate: { lte: isoToDate(days[4]) }, endDate: { gte: isoToDate(days[0]) } } }),
  ]);
  const eligibilityByKind = new Map([...new Set(shifts.map((s) => s.kind))].map((k) => [k, eligibilityFor(me, k, training.statuses)] as const));
  const isAway = (iso: string) => absences.some((a) => a.startDate <= isoToDate(iso) && a.endDate >= isoToDate(iso));
  const thisWeek = weekMonday(today);
  // Why some shifts are locked, said once above the list rather than on every
  // card: only for kinds that actually appear on a day still to come.
  // Harvests are left out: their lock is the harvest pool, joined from the
  // Harvest page.
  const upcomingKinds = new Set(shifts.filter((s) => s.iso >= today && s.kind !== "HARVEST").map((s) => s.kind));
  const locks = [...eligibilityByKind.entries()].filter(([kind, e]) => upcomingKinds.has(kind) && !e.eligible).map(([, e]) => e);
  // In the current week only: browsing back to an old week shows every day.
  // On a phone the days gone by fold away so the week opens on today; with
  // room for the whole week they stay in place, dimmed.
  const earlier = monday === thisWeek ? days.filter((iso) => iso < today) : [];

  // One day, laid out three ways by the width of <main>: stacked on a phone,
  // a row with the day on the left in the middle, a column of the week board
  // once all five fit side by side.
  const renderDay = (iso: string, idPrefix: string, className?: string) => {
    const dayShifts = shifts.filter((s) => s.iso === iso);
    const past = iso < today;
    const isToday = iso === today;
    const away = isAway(iso);
    const headingId = `${idPrefix}-${iso}`;
    // Same rule as the card's lock: never on a day gone by, the volunteer's own
    // shift or a cancelled one.
    const isLocked = (view: ShiftView) =>
      !past && view.shift.status !== "CANCELLED" && !view.confirmed.some((a) => a.volunteerId === me.id) && !eligibilityByKind.get(view.kind)!.eligible;
    const open = dayShifts.filter((v) => !isLocked(v));
    const locked = dayShifts.filter(isLocked);
    return (
      <section
        key={iso}
        aria-labelledby={headingId}
        className={cn(
          "@3xl/app:grid @3xl/app:grid-cols-[8.5rem_minmax(0,1fr)] @3xl/app:gap-6 @3xl/app:border-t @3xl/app:border-border @3xl/app:pt-5",
          "@6xl/app:flex @6xl/app:flex-col @6xl/app:gap-3 @6xl/app:rounded-3xl @6xl/app:border-t-0 @6xl/app:p-3",
          isToday ? "@6xl/app:bg-teal-tint-soft @6xl/app:ring-1 @6xl/app:ring-teal/25" : "@6xl/app:bg-muted/60",
          className,
        )}
      >
        <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 @3xl/app:mb-0 @3xl/app:flex-col @3xl/app:items-start @3xl/app:gap-1.5 @6xl/app:px-1.5 @6xl/app:pt-1">
          {/* Today sits beside the day's name so every column of the week
              board starts its cards at the same height. */}
          <span className="flex items-center gap-2">
            <h2 id={headingId} className={cn("text-lg @3xl/app:text-xl", isToday ? "text-teal" : past ? "text-muted-foreground" : "text-ink")}>
              {WEEKDAY_LONG[weekdayOf(iso)]}
            </h2>
            {isToday && <span className="rounded-full bg-teal px-2 py-0.5 text-xs font-bold text-white">Today</span>}
          </span>
          <span className={cn("text-sm text-muted-foreground tabular", past && "@3xl/app:opacity-80")}>{formatDayShort(iso)}</span>
          {away && <Chip tone="neutral" icon={CalendarOff} size="sm">You&apos;re away</Chip>}
        </div>
        {dayShifts.length === 0 ? (
          <EmptyState title="No shifts scheduled" className="py-4 @6xl/app:border-transparent @6xl/app:bg-transparent" />
        ) : (
          <div className="flex flex-col gap-2.5 @4xl/app:gap-3">
            {open.length > 0 && (
              <div className={cn("grid gap-2.5 @4xl/app:grid-cols-2 @4xl/app:gap-3 @6xl/app:grid-cols-1", past && "@3xl/app:opacity-75")}>
                {open.map((view) => {
                  const e = eligibilityByKind.get(view.kind)!;
                  return <ShiftCard key={view.shift.id} view={view} meId={me.id} eligible={e.eligible} needsRole={!e.hasRole} reason={e.reason} past={past} />;
                })}
              </div>
            )}
            {locked.length > 0 && (
              // Shifts the volunteer cannot book fold away under the ones
              // they can, so a day of mostly locked shifts stays short.
              <details className="group/locked rounded-2xl border border-border bg-card/60">
                <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3.5 text-sm font-semibold text-status-neutral [&::-webkit-details-marker]:hidden">
                  <Lock className="size-4 shrink-0" aria-hidden />
                  <span className="flex-1">
                    Locked<span className="@6xl/app:hidden"> for you</span> <span className="tabular">({locked.length})</span>
                  </span>
                  <ChevronDown className="size-4.5 shrink-0 transition-transform group-open/locked:rotate-180" aria-hidden />
                </summary>
                <div className="grid gap-2 px-2 pb-2 @4xl/app:grid-cols-2 @6xl/app:grid-cols-1">
                  {locked.map((view) => (
                    <LockedShiftCard key={view.shift.id} view={view} needsRole={!eligibilityByKind.get(view.kind)!.hasRole} />
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </section>
    );
  };

  const weekNav = (
    <nav aria-label="Week" className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-card p-1.5 @3xl/app:min-w-[19rem]">
      <Link href={`/app/shifts?week=${addDays(monday, -7)}`} className="tap flex items-center justify-center rounded-xl text-ink hover:bg-muted" aria-label="Previous week">
        <ChevronLeft className="size-6" aria-hidden />
      </Link>
      <div className="text-center">
        <p className="font-bold text-ink tabular">
          {formatDayShort(days[0])} - {formatDayShort(days[4])}
        </p>
        <p className="font-display text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {monday === thisWeek ? "This week" : monday === addDays(thisWeek, 7) ? "Next week" : formatMonth(days[0])}
        </p>
      </div>
      <Link href={`/app/shifts?week=${addDays(monday, 7)}`} className="tap flex items-center justify-center rounded-xl text-ink hover:bg-muted" aria-label="Next week">
        <ChevronRight className="size-6" aria-hidden />
      </Link>
    </nav>
  );

  return (
    <AppPage className="gap-5">
      <AppPageHeader eyebrow="Monday to Friday" title="Shifts" aside={weekNav} />

      {locks.length > 0 && <LockBanner title="Some shifts are locked for you" locks={locks} />}

      {earlier.length > 0 && (
        <details className="group rounded-2xl border border-border bg-card/60 @3xl/app:hidden">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 px-4 font-semibold text-ink-soft [&::-webkit-details-marker]:hidden">
            Earlier this week ({earlier.length} {earlier.length === 1 ? "day" : "days"})
            <ChevronDown className="size-5 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <div className="flex flex-col gap-5 px-3 pb-4 pt-1">{earlier.map((iso) => renderDay(iso, "earlier"))}</div>
        </details>
      )}

      <div className="flex flex-col gap-5 @6xl/app:grid @6xl/app:grid-cols-5 @6xl/app:items-start @6xl/app:gap-3">
        {days.map((iso) => renderDay(iso, "day", earlier.includes(iso) ? "hidden @3xl/app:grid @6xl/app:flex" : undefined))}
      </div>
    </AppPage>
  );
}
