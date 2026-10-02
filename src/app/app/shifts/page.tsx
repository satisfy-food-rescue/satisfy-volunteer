import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireVolunteer } from "@/lib/session";
import { addDays, formatDayShort, todayISO, weekMonday, workWeek, WEEKDAY_LONG, weekdayOf, isoToDate, formatMonth } from "@/lib/dates";
import { shiftsBetween } from "@/lib/roster";
import { trainingContext } from "@/lib/volunteer-data";
import { eligibilityFor } from "@/lib/training";
import { ShiftCard } from "@/components/app/shift-card";
import { cn } from "@/lib/utils";
import { db } from "@/lib/db";

export const metadata = { title: "Shifts" };

export default async function ShiftsPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const me = await requireVolunteer();
  const today = todayISO();
  const { week } = await searchParams;
  const monday = weekMonday(week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? week : today);
  const days = workWeek(monday);
  const [shifts, training, absences] = await Promise.all([
    shiftsBetween(days[0], days[4]),
    trainingContext(me, today),
    db.absence.findMany({ where: { volunteerId: me.id, startDate: { lte: isoToDate(days[4]) }, endDate: { gte: isoToDate(days[0]) } } }),
  ]);
  const eligibilityByKind = new Map(
    ["WAREHOUSE", "DRIVERS_ASSISTANT", "VOLUNTEER_DRIVER"].map((k) => [k, eligibilityFor(me, k as never, training.statuses)] as const),
  );
  const isAway = (iso: string) => absences.some((a) => a.startDate <= isoToDate(iso) && a.endDate >= isoToDate(iso));
  const thisWeek = weekMonday(today);

  return (
    <div className="flex flex-col gap-5 px-5 pb-6 pt-5">
      <div>
        <p className="eyebrow">Monday to Friday</p>
        <h1 className="mt-1 text-3xl text-ink">Shifts</h1>
      </div>

      <nav aria-label="Week" className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-card p-1.5">
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

      {days.map((iso) => {
        const dayShifts = shifts.filter((s) => s.iso === iso);
        const past = iso < today;
        const away = isAway(iso);
        return (
          <section key={iso} aria-labelledby={`day-${iso}`} className={cn(past && "opacity-60")}>
            <div className="mb-2 flex items-baseline gap-2">
              <h2 id={`day-${iso}`} className={cn("text-lg text-ink", iso === today && "text-green-text")}>
                {WEEKDAY_LONG[weekdayOf(iso)]}
              </h2>
              <span className="text-sm text-muted-foreground tabular">{formatDayShort(iso)}</span>
              {iso === today && <span className="rounded-full bg-green-tint px-2 py-0.5 text-xs font-bold text-green-deep">Today</span>}
              {away && <span className="rounded-full bg-status-neutral-bg px-2 py-0.5 text-xs font-bold text-status-neutral">You&apos;re away</span>}
            </div>
            {dayShifts.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">No shifts scheduled.</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {dayShifts.map((view) => {
                  const e = eligibilityByKind.get(view.kind)!;
                  return <ShiftCard key={view.shift.id} view={view} meId={me.id} eligible={e.eligible} reason={e.reason} />;
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
