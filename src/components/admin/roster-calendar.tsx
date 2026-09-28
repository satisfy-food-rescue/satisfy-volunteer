import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ShiftView } from "@/lib/roster";
import { addDays, formatDayShort, formatMonth, monthEnd, monthStart, weekdayOf, workWeek, WEEKDAY_SHORT, isoToDate, dateToISO, formatDay } from "@/lib/dates";
import { cn } from "@/lib/utils";

export function WeekView({ monday, shifts, today }: { monday: string; shifts: ShiftView[]; today: string }) {
  const days = workWeek(monday);
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
      {days.map((iso) => {
        const items = shifts.filter((s) => s.iso === iso);
        const gaps = items.filter((s) => s.isGap).length;
        return (
          <section key={iso} className={cn("flex flex-col gap-2 rounded-2xl border bg-card/50 p-3", iso === today ? "border-green" : "border-border")}>
            <header className="flex items-baseline justify-between">
              <h2 className={cn("text-lg text-ink", iso === today && "text-green-text")}>{WEEKDAY_SHORT[weekdayOf(iso)]} <span className="font-sans text-sm text-muted-foreground tabular">{formatDayShort(iso)}</span></h2>
              {gaps > 0 && <span className="rounded-full bg-status-bad-bg px-2 py-0.5 text-xs font-bold text-status-bad">{gaps} gap{gaps === 1 ? "" : "s"}</span>}
            </header>
            {items.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">No shifts</p>
            ) : (
              items.map((s) => <CompactShift key={s.shift.id} view={s} />)
            )}
          </section>
        );
      })}
    </div>
  );
}

function CompactShift({ view }: { view: ShiftView }) {
  const cancelled = view.shift.status === "CANCELLED";
  return (
    <Link
      href={`/admin/roster/${view.shift.id}`}
      className={cn(
        "flex flex-col gap-1 rounded-xl border-l-4 bg-card p-2.5 shadow-sm ring-1 ring-border transition-colors hover:ring-green",
        cancelled ? "border-l-muted-foreground opacity-60" : view.isGap ? "border-l-magenta" : "border-l-green",
      )}
    >
      <span className="text-sm font-bold leading-tight text-ink">{view.shift.template.name.replace("Driver's assistant: ", "DA: ").replace("Volunteer driver: ", "Driver: ")}</span>
      <span className="flex items-center justify-between text-xs text-muted-foreground tabular">
        <span>{view.shift.startTime}</span>
        <span className={cn("font-bold", view.isGap ? "text-status-bad" : "text-status-good")}>
          {cancelled ? "Cancelled" : view.isGap ? `${view.confirmedCount}/${view.shift.needed} short ${view.shortBy}` : `${view.confirmedCount}/${view.shift.capacity}`}
        </span>
      </span>
      {!cancelled && (
        <span className="line-clamp-1 text-xs text-ink-soft">{view.confirmed.map((a) => a.volunteer.firstName).join(", ") || "Nobody rostered"}</span>
      )}
    </Link>
  );
}

export function MonthView({ anchor, shifts, today }: { anchor: string; shifts: ShiftView[]; today: string }) {
  const start = monthStart(anchor);
  const end = monthEnd(anchor);
  // Grid from the Monday on/before the 1st to the Friday on/after the last.
  const firstMon = addDays(start, 1 - weekdayOf(start));
  const weeks: string[][] = [];
  for (let d = firstMon; d <= end; d = addDays(d, 7)) weeks.push(workWeek(d));
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="grid grid-cols-5 border-b border-border bg-muted/60">
        {["Mon", "Tue", "Wed", "Thu", "Fri"].map((d) => <div key={d} className="px-3 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">{d}</div>)}
      </div>
      {weeks.map((week, i) => (
        <div key={i} className="grid grid-cols-5 border-b border-border last:border-b-0">
          {week.map((iso) => {
            const inMonth = iso >= start && iso <= end;
            const items = shifts.filter((s) => s.iso === iso);
            const gaps = items.filter((s) => s.isGap);
            const filled = items.reduce((n, s) => n + s.confirmedCount, 0);
            return (
              <div key={iso} className={cn("min-h-24 border-r border-border p-2 last:border-r-0", !inMonth && "bg-muted/30 text-muted-foreground", iso === today && "bg-green-tint-soft")}>
                <div className="flex items-center justify-between">
                  <span className={cn("text-sm font-bold tabular", iso === today && "rounded-full bg-green px-1.5 text-green-deep")}>{Number(iso.slice(8))}</span>
                  {gaps.length > 0 && <span className="rounded-full bg-status-bad-bg px-1.5 text-[0.65rem] font-bold text-status-bad">{gaps.length} gap{gaps.length === 1 ? "" : "s"}</span>}
                </div>
                {inMonth && items.length > 0 && (
                  <Link href={`/admin/roster?view=week&date=${iso}`} className="mt-1 block text-xs text-ink-soft hover:underline">
                    {items.length} shifts · {filled} on
                  </Link>
                )}
                {gaps.slice(0, 2).map((g) => (
                  <Link key={g.shift.id} href={`/admin/roster/${g.shift.id}`} className="mt-1 block truncate rounded bg-magenta-tint px-1.5 py-0.5 text-[0.7rem] font-semibold text-magenta hover:underline">
                    {g.shift.template.name.replace("Driver's assistant: ", "DA: ")}
                  </Link>
                ))}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function RosterNav({ view, anchor, today }: { view: "week" | "month"; anchor: string; today: string }) {
  const prev = view === "week" ? addDays(anchor, -7) : dateToISO(new Date(Date.UTC(isoToDate(anchor).getUTCFullYear(), isoToDate(anchor).getUTCMonth() - 1, 1)));
  const next = view === "week" ? addDays(anchor, 7) : dateToISO(new Date(Date.UTC(isoToDate(anchor).getUTCFullYear(), isoToDate(anchor).getUTCMonth() + 1, 1)));
  const label = view === "week" ? `${formatDay(anchor)} - ${formatDayShort(addDays(anchor, 4))}` : formatMonth(anchor);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center rounded-xl border border-border bg-card p-1">
        <Link href={`/admin/roster?view=${view}&date=${prev}`} className="tap flex items-center justify-center rounded-lg hover:bg-muted" aria-label={`Previous ${view}`}><ChevronLeft className="size-5" /></Link>
        <span className="min-w-44 px-2 text-center font-bold text-ink tabular">{label}</span>
        <Link href={`/admin/roster?view=${view}&date=${next}`} className="tap flex items-center justify-center rounded-lg hover:bg-muted" aria-label={`Next ${view}`}><ChevronRight className="size-5" /></Link>
      </div>
      <Link href={`/admin/roster?view=${view}&date=${today}`} className="flex h-11 items-center rounded-xl border border-border bg-card px-3 text-sm font-semibold hover:bg-muted">Today</Link>
      <div className="ml-auto flex rounded-xl border border-border bg-card p-1" role="tablist" aria-label="Roster view">
        {(["week", "month"] as const).map((v) => (
          <Link key={v} href={`/admin/roster?view=${v}&date=${anchor}`} role="tab" aria-selected={view === v} className={cn("flex h-9 items-center rounded-lg px-3 text-sm font-semibold capitalize", view === v ? "bg-green-tint text-green-deep" : "text-muted-foreground hover:text-ink")}>
            {v}
          </Link>
        ))}
      </div>
    </div>
  );
}
