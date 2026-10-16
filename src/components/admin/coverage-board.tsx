import Link from "next/link";
import { ArrowRight, CheckCircle2, HandHelping } from "lucide-react";
import type { ShiftView } from "@/lib/roster";
import { WEEKDAY_SHORT, formatDay, formatTime, formatTimeRange, isoToDate, weekdayOf } from "@/lib/dates";
import { isAdHocKind } from "@/lib/domain";
import { ShiftKindIcon } from "@/components/app/shift-card";
import { cn } from "@/lib/utils";

type Week = { label: string; days: string[] };

type BlockState = "past" | "cancelled" | "draft" | "gap" | "open" | "covered";

function stateOf(view: ShiftView, past: boolean): BlockState {
  if (view.shift.status === "CANCELLED") return "cancelled";
  if (past) return "past";
  if (view.isDraft) return "draft";
  if (view.isGap) return "gap";
  if (isAdHocKind(view.kind) && view.shortBy > 0) return "open";
  return "covered";
}

const BLOCK_CLASS: Record<BlockState, string> = {
  past: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground line-through",
  draft: "border border-dashed border-teal/60 bg-card text-teal",
  gap: "bg-orange text-ink hover:bg-orange-hover",
  open: "border border-green/70 bg-card text-green-deep",
  covered: "bg-green-tint text-green-deep hover:bg-green-tint/70",
};

const STATE_WORDS: Record<BlockState, (v: ShiftView) => string> = {
  past: () => "finished",
  cancelled: () => "cancelled",
  draft: () => "draft",
  gap: (v) => `needs ${v.shortBy} more`,
  open: (v) => `${v.shortBy} places to fill`,
  covered: () => "covered",
};

/** A route shift is known by its route; anything else by its name. */
function shortName(view: ShiftView) {
  return view.shift.template.route?.name ?? view.name;
}

function ShiftBlock({ view, past }: { view: ShiftView; past: boolean }) {
  const state = stateOf(view, past);
  const words = `${formatDay(view.iso)}, ${view.name}, ${formatTimeRange(view.shift.startTime, view.shift.endTime)}: ${view.confirmedCount} of ${view.shift.capacity} booked, ${STATE_WORDS[state](view)}`;
  return (
    <li>
      <Link
        href={`/admin/roster/${view.shift.id}`}
        aria-label={words}
        title={words}
        className={cn(
          "flex min-h-9 items-center gap-1 rounded-lg px-1.5 py-1.5 font-display text-xs font-bold leading-tight transition-colors @xl/board:gap-1.5 @xl/board:px-2",
          BLOCK_CLASS[state],
        )}
      >
        {state === "gap" ? <HandHelping className="size-4 shrink-0" aria-hidden /> : <ShiftKindIcon kind={view.kind} className="size-4 shrink-0" />}
        {/* Name where there is room, else the start time, else just the count. */}
        <span className="hidden min-w-0 flex-1 @3xl/board:line-clamp-2">{shortName(view)}</span>
        <span className="hidden flex-1 tabular @md/board:inline @3xl/board:hidden">{formatTime(view.shift.startTime)}</span>
        <span className="ml-auto shrink-0 tabular">
          {view.confirmedCount}/{view.shift.capacity}
        </span>
      </Link>
    </li>
  );
}

function DayColumn({ iso, shifts, today }: { iso: string; shifts: ShiftView[]; today: string }) {
  const past = iso < today;
  const isToday = iso === today;
  const gaps = shifts.filter((s) => !past && s.isGap).length;
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-2 rounded-2xl p-1 @xl/board:p-2",
        isToday && "bg-teal-tint-soft ring-2 ring-teal",
      )}
    >
      <h4 className="flex flex-col px-1 pt-0.5 @xl/board:flex-row @xl/board:items-baseline @xl/board:gap-1.5">
        <span className={cn("text-xs font-bold uppercase tracking-wide", isToday ? "text-teal" : "text-muted-foreground")}>
          {WEEKDAY_SHORT[weekdayOf(iso)]}
        </span>
        <span className={cn("font-display text-xl font-bold leading-tight tabular @xl/board:text-2xl", past ? "text-muted-foreground" : "text-ink")}>
          {isoToDate(iso).getUTCDate()}
        </span>
        {isToday && <span className="sr-only">(today)</span>}
        {gaps > 0 && (
          <span className="ml-auto hidden size-5 items-center justify-center rounded-full bg-orange text-xs font-bold text-ink tabular @xl/board:inline-flex" aria-label={`${gaps} to cover`}>
            {gaps}
          </span>
        )}
      </h4>
      {shifts.length === 0 ? (
        <p className="px-1 text-xs text-muted-foreground">No shifts</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {shifts.map((s) => (
            <ShiftBlock key={s.shift.id} view={s} past={past} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Legend() {
  const items: [string, string][] = [
    ["border border-green/30 bg-green-tint", "Covered"],
    ["bg-orange", "Needs cover"],
    ["border border-green/70 bg-card", "Harvest places open"],
    ["border border-dashed border-teal/60 bg-card", "Draft"],
  ];
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground" aria-label="Key">
      {items.map(([cls, label]) => (
        <li key={label} className="inline-flex items-center gap-1.5">
          <span className={cn("size-3 rounded", cls)} aria-hidden />
          {label}
        </li>
      ))}
    </ul>
  );
}

/** Two working weeks of the roster at a glance, so the gaps are the first
 *  thing a coordinator sees. Every block opens its shift. */
export function CoverageBoard({ weeks, shifts, today }: { weeks: Week[]; shifts: ShiftView[]; today: string }) {
  const upcomingGaps = shifts.filter((s) => s.iso >= today && s.isGap);
  const next = upcomingGaps[0];
  const shortTotal = upcomingGaps.reduce((n, s) => n + s.shortBy, 0);
  return (
    <section aria-labelledby="board-h" className="@container/board rounded-3xl bg-card p-3 shadow-raised ring-1 ring-border @md/admin:p-4 @2xl/admin:p-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="eyebrow">{weeks.map((w, i) => (i === 0 ? w.label : w.label.toLowerCase())).join(" and ")}</p>
          {next ? (
            <>
              <h2 id="board-h" className="mt-1.5 flex items-center gap-3 text-3xl text-ink @xl/board:text-4xl">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-orange text-ink">
                  <HandHelping className="size-6" aria-hidden />
                </span>
                {upcomingGaps.length} {upcomingGaps.length === 1 ? "shift needs" : "shifts need"} cover
              </h2>
              <p className="mt-2 max-w-2xl text-muted-foreground">
                {shortTotal} {shortTotal === 1 ? "place" : "places"} to fill. Next is {formatDay(next.iso)}, {next.name}
                {next.causes.length > 0 ? `: ${next.causes.join(", ")}.` : "."}
              </p>
            </>
          ) : (
            <>
              <h2 id="board-h" className="mt-1.5 flex items-center gap-3 text-3xl text-ink @xl/board:text-4xl">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-green-tint text-green-deep">
                  <CheckCircle2 className="size-6" aria-hidden />
                </span>
                Every shift is covered
              </h2>
              <p className="mt-2 text-muted-foreground">Each shift below has its minimum crew. Ka pai.</p>
            </>
          )}
        </div>
        <Link href="/admin/roster" className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 font-semibold text-teal hover:bg-teal-tint-soft">
          Open the roster <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>

      <div className="mt-5 flex flex-col gap-4">
        {weeks.map((week) => (
          <div key={week.label}>
            <h3 className="mb-1.5 px-1 text-sm font-semibold text-ink-soft">{week.label}</h3>
            <div className="grid grid-cols-5 gap-1 @xl/board:gap-2">
              {week.days.map((iso) => (
                <DayColumn key={iso} iso={iso} today={today} shifts={shifts.filter((s) => s.iso === iso)} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <Legend />
      </div>
    </section>
  );
}
