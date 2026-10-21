import Link from "next/link";
import { AlertTriangle, Ban, ChevronLeft, ChevronRight, PencilLine } from "lucide-react";
import type { ShiftView } from "@/lib/roster";
import { addDays, formatDayShort, formatMonth, monthEnd, monthStart, weekdayOf, workWeek, WEEKDAY_SHORT, isoToDate, dateToISO, formatDay, formatTime } from "@/lib/dates";
import { SHIFT_KIND_LABEL } from "@/lib/domain";
import { ShiftKindIcon } from "@/components/app/shift-card";
import { cn } from "@/lib/utils";

export function WeekView({ monday, shifts, today }: { monday: string; shifts: ShiftView[]; today: string }) {
  const days = workWeek(monday);
  return (
    <div className="grid grid-cols-1 gap-4 @2xl/admin:grid-cols-5 @2xl/admin:gap-2 @6xl/admin:gap-3">
      {days.map((iso) => {
        const items = shifts.filter((s) => s.iso === iso);
        const gaps = items.filter((s) => s.isGap).length;
        return (
          <section key={iso} className={cn("flex min-w-0 flex-col gap-2 rounded-2xl border bg-card/50 p-3 @2xl/admin:p-2 @6xl/admin:p-2.5", iso === today ? "border-teal" : "border-border")}>
            <header className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 px-0.5">
              <h2 className={cn("text-lg text-ink", iso === today && "text-teal")}>{WEEKDAY_SHORT[weekdayOf(iso)]} <span className="font-sans text-sm text-muted-foreground tabular">{formatDayShort(iso)}</span></h2>
              {gaps > 0 && <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-status-warn-bg px-2 py-0.5 text-xs font-bold text-status-warn"><AlertTriangle className="size-3" aria-hidden />{gaps} gap{gaps === 1 ? "" : "s"}</span>}
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

/** A route shift is known by its route, with the kind beside its time;
 *  anything else by its own name. Keeps the narrow week columns readable. */
function shortName(view: ShiftView) {
  return view.shift.template.route?.name ?? view.name;
}

function CompactShift({ view }: { view: ShiftView }) {
  const cancelled = view.shift.status === "CANCELLED";
  const draft = view.isDraft;
  const route = view.shift.template.route;
  const fill = Math.min(100, Math.round((view.confirmedCount / Math.max(1, view.shift.capacity)) * 100));
  return (
    <Link
      href={`/admin/roster/${view.shift.id}`}
      title={view.name}
      className={cn(
        "flex flex-col gap-1 rounded-xl p-2 shadow-sm transition-colors @6xl/admin:p-2.5",
        cancelled
          ? "border border-dashed border-border bg-card/60"
          : draft
            ? "border border-dashed border-teal/60 bg-teal-tint-soft hover:border-teal"
            : view.isGap
            ? "bg-orange-tint/40 ring-1 ring-orange/50 hover:ring-orange"
            : "bg-card ring-1 ring-border hover:ring-teal/60",
      )}
    >
      {/* The name gets the full width; long route names hyphenate rather than
          spill out of the narrow week columns. */}
      <span lang="en-NZ" className={cn("hyphens-auto break-words text-sm font-bold leading-tight text-ink", cancelled && "text-muted-foreground line-through")}>
        {shortName(view)}
        {route && <span className="sr-only">, {SHIFT_KIND_LABEL[view.kind]}</span>}
      </span>
      <span className="flex items-start gap-1 text-xs text-muted-foreground">
        <ShiftKindIcon kind={view.kind} className={cn("mt-px size-3.5 shrink-0", cancelled ? "text-muted-foreground" : view.kind === "WAREHOUSE" || view.kind === "HARVEST" ? "text-green-deep" : "text-sky-text")} />
        <span className="tabular">
          {formatTime(view.shift.startTime)}
          {route && <span aria-hidden> · {SHIFT_KIND_LABEL[view.kind]}</span>}
        </span>
      </span>
      {!cancelled && !draft && (
        <span className="text-xs leading-snug text-ink-soft">
          {view.confirmed.map((a) => a.volunteer.firstName).join(", ") || "Nobody rostered"}
        </span>
      )}
      <span className="mt-0.5 flex items-center gap-2">
        {/* Fill level of the shift, beside its count. */}
        <span className="block h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
          {!cancelled && !draft && <span className={cn("block h-full rounded-full", view.isGap ? "bg-orange" : "bg-green")} style={{ width: `${fill}%` }} />}
        </span>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-1.5 py-0.5 font-display text-xs font-bold leading-none tabular",
            cancelled ? "bg-muted text-muted-foreground" : draft ? "bg-teal-tint text-teal-deep" : view.isGap ? "bg-orange-tint text-orange-text" : "bg-green-tint-soft text-green-text",
          )}
        >
          {cancelled ? (
            <>
              <Ban className="size-3" aria-hidden />
              Cancelled
            </>
          ) : draft ? (
            <>
              <PencilLine className="size-3" aria-hidden />
              Draft
            </>
          ) : view.isGap ? (
            <>
              <AlertTriangle className="size-3" aria-hidden />
              Short {view.shortBy}
            </>
          ) : (
            <>
              {view.confirmedCount}/{view.shift.capacity}
              <span className="sr-only"> booked</span>
            </>
          )}
        </span>
      </span>
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
        {["Mon", "Tue", "Wed", "Thu", "Fri"].map((d) => <div key={d} className="font-display px-3 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">{d}</div>)}
      </div>
      {weeks.map((week, i) => (
        <div key={i} className="grid grid-cols-5 border-b border-border last:border-b-0">
          {week.map((iso) => {
            const inMonth = iso >= start && iso <= end;
            const items = shifts.filter((s) => s.iso === iso);
            const gaps = items.filter((s) => s.isGap);
            const filled = items.reduce((n, s) => n + s.confirmedCount, 0);
            return (
              <div key={iso} className={cn("min-h-24 border-r border-border p-2 last:border-r-0", !inMonth && "bg-muted/30 text-muted-foreground", iso === today && "bg-teal-tint-soft")}>
                <div className="flex items-center justify-between">
                  <span className={cn("text-sm font-bold tabular", iso === today && "rounded-full bg-teal px-1.5 text-white")}>{Number(iso.slice(8))}</span>
                  {gaps.length > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-status-warn-bg px-1.5 text-xs font-bold text-status-warn"><AlertTriangle className="size-3" aria-hidden />{gaps.length} gap{gaps.length === 1 ? "" : "s"}</span>}
                </div>
                {inMonth && items.length > 0 && (
                  <Link href={`/admin/roster?view=week&date=${iso}`} className="mt-1 block text-xs text-ink-soft hover:underline">
                    {items.length} {items.length === 1 ? "shift" : "shifts"} · {filled} on
                  </Link>
                )}
                {gaps.slice(0, 2).map((g) => (
                  <Link key={g.shift.id} href={`/admin/roster/${g.shift.id}`} title={g.name} className="mt-1 block truncate rounded bg-orange-tint px-1.5 py-0.5 text-xs font-semibold text-orange-text hover:underline">
                    {shortName(g)}
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
        <Link href={`/admin/roster?view=${view}&date=${prev}`} className="tap flex items-center justify-center rounded-lg hover:bg-muted" aria-label={`Previous ${view}`}><ChevronLeft className="size-5" aria-hidden /></Link>
        <span className="min-w-44 px-2 text-center font-bold text-ink tabular">{label}</span>
        <Link href={`/admin/roster?view=${view}&date=${next}`} className="tap flex items-center justify-center rounded-lg hover:bg-muted" aria-label={`Next ${view}`}><ChevronRight className="size-5" aria-hidden /></Link>
      </div>
      <Link href={`/admin/roster?view=${view}&date=${today}`} className="flex h-11 items-center rounded-xl border border-border bg-card px-3 text-sm font-semibold hover:bg-muted">Today</Link>
      <nav className="ml-auto flex rounded-xl border border-border bg-card p-1" aria-label="Roster view">
        {(["week", "month"] as const).map((v) => (
          <Link key={v} href={`/admin/roster?view=${v}&date=${anchor}`} aria-current={view === v ? "page" : undefined} className={cn("flex h-9 items-center rounded-lg px-3 text-sm font-semibold capitalize", view === v ? "bg-teal-tint text-teal-deep" : "text-muted-foreground hover:text-ink")}>
            {v}
          </Link>
        ))}
      </nav>
    </div>
  );
}
