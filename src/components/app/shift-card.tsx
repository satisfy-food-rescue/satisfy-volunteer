import Link from "next/link";
import { Ban, CheckCircle2, ChevronRight, HandHelping, History, Lock, MapPin, Sprout, Users } from "lucide-react";
import type { ShiftView } from "@/lib/roster";
import { formatDay, formatTimeRange } from "@/lib/dates";
import { isAdHocKind } from "@/lib/domain";
import { Chip } from "@/components/shared/status-chip";
import { AvatarBadge } from "@/components/shared/avatar-badge";
import { cn } from "@/lib/utils";

/** Tile colours per kind: green for the warehouse and harvests (food), light
 *  blue for anything on the road. */
export function kindTileClass(kind: string) {
  return kind === "WAREHOUSE" || kind === "HARVEST" ? "bg-green-tint text-green-deep" : "bg-sky-tint text-sky-text";
}

export function ShiftKindIcon({ kind, className }: { kind: string; className?: string }) {
  const cls = cn("size-5", className);
  if (kind === "HARVEST") return <Sprout className={cls} aria-hidden />;
  if (kind === "WAREHOUSE") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cls} aria-hidden>
        <path d="M3 20V9l9-5 9 5v11" /><path d="M7 20v-6h10v6" /><path d="M10 14v6" /><path d="M14 14v6" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cls} aria-hidden>
      <path d="M3 7h11v9H3z" /><path d="M14 10h4l3 3v3h-7" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" />
    </svg>
  );
}

/** A shift the volunteer cannot book, kept small and grey so the ones they
 *  can take stand out. The page says why once, in its lock banner. */
export function LockedShiftCard({ view, needsRole, showDate = false }: { view: ShiftView; needsRole: boolean; showDate?: boolean }) {
  return (
    <Link
      href={`/app/shifts/${view.shift.id}`}
      className="group @container/card flex items-center gap-3 rounded-xl border border-border bg-card/60 px-3.5 py-2.5 text-sm transition-colors hover:border-teal/60"
    >
      <span className="hidden size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground @min-[17rem]/card:flex">
        <ShiftKindIcon kind={view.kind} className="size-4.5" />
      </span>
      {/* In a narrow board column the lock goes under the time. */}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 @min-[20rem]/card:flex-row @min-[20rem]/card:items-center @min-[20rem]/card:gap-3">
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 font-semibold text-ink-soft">{view.name}</span>
          <span className="block text-muted-foreground tabular">
            {showDate && `${formatDay(view.iso)}, `}
            {formatTimeRange(view.shift.startTime, view.shift.endTime)}
          </span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-status-neutral">
          <Lock className="size-3.5" aria-hidden />
          {needsRole ? (view.kind === "HARVEST" ? "Join the pool" : "Role needed") : "Training needed"}
        </span>
      </span>
    </Link>
  );
}

export function ShiftCard({
  view,
  meId,
  eligible,
  needsRole,
  reason,
  showDate = false,
  past = false,
}: {
  view: ShiftView;
  meId: string;
  eligible: boolean;
  /** Blocked by a missing role rather than lapsed training. */
  needsRole: boolean;
  reason: string | null;
  /** For lists that span days rather than sitting under a day heading. */
  showDate?: boolean;
  /** A shift on a day gone by: no calls to action, just what happened. */
  past?: boolean;
}) {
  const mine = view.confirmed.find((a) => a.volunteerId === meId);
  const cancelled = view.shift.status === "CANCELLED";
  const others = view.confirmed.filter((a) => a.volunteerId !== meId);
  const locked = !cancelled && !mine && !eligible && !past;
  const crewCount = (className: string) => (
    <span className={cn("items-center gap-1.5 text-sm text-muted-foreground tabular", className)}>
      <Users className="size-4" aria-hidden />
      {view.confirmedCount}/{view.shift.capacity}
    </span>
  );
  return (
    // Sized by its column, not the screen: in a narrow board column the kind
    // tile goes (the name already says the kind) so the text keeps its width.
    <Link
      href={`/app/shifts/${view.shift.id}`}
      className={cn(
        "group @container/card block rounded-2xl border transition-colors hover:border-teal/60",
        past ? "bg-card/60" : "bg-card shadow-sm",
        mine && !past ? "border-green/60" : "border-border",
        view.isGap && !mine && !past && "border-orange/60",
      )}
    >
      <span className="flex items-stretch gap-3 p-3.5 @min-[17rem]/card:p-4">
        <span className={cn("hidden w-11 shrink-0 items-center justify-center rounded-xl @min-[17rem]/card:flex", kindTileClass(view.kind))}>
          <ShiftKindIcon kind={view.kind} className="size-6" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="flex items-start justify-between gap-2">
            <span className="min-w-0">
              <span className="line-clamp-3 font-bold text-ink @min-[17rem]/card:line-clamp-2">{view.name}</span>
              <span className="block text-sm text-muted-foreground tabular">
                {showDate && `${formatDay(view.iso)}, `}
                {formatTimeRange(view.shift.startTime, view.shift.endTime)}
              </span>
              {isAdHocKind(view.kind) && (
                <span className="mt-0.5 flex items-start gap-1 text-sm text-muted-foreground">
                  <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  <span className="line-clamp-1">{view.location}</span>
                </span>
              )}
            </span>
            <ChevronRight className="mt-1 hidden size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 @min-[17rem]/card:block" aria-hidden />
          </span>
          <span className="flex flex-wrap items-center gap-2">
            {cancelled ? (
              <Chip tone="neutral" icon={Ban} size="sm">Cancelled</Chip>
            ) : past ? (
              <Chip tone="neutral" icon={History} size="sm">{mine ? "You were on" : "Finished"}</Chip>
            ) : mine ? (
              <Chip tone="good" icon={CheckCircle2} size="sm">{mine.source === "REGULAR" ? "Your regular slot" : "You're on"}</Chip>
            ) : view.isGap ? (
              <Chip tone="warn" icon={HandHelping} size="sm">Needs cover</Chip>
            ) : view.isFull ? (
              <Chip tone="neutral" size="sm">Full</Chip>
            ) : isAdHocKind(view.kind) && eligible ? (
              <Chip tone="info" size="sm">{view.spotsLeft} {view.spotsLeft === 1 ? "place" : "places"} left</Chip>
            ) : null}
            {locked && <Chip tone="neutral" icon={Lock} size="sm">{needsRole ? (view.kind === "HARVEST" ? "Join the pool" : "Role needed") : "Training needed"}</Chip>}
            {crewCount("ml-auto hidden @min-[17rem]/card:inline-flex")}
          </span>
          {/* In a narrow card the count moves down beside the faces, and the
              names are left to screen readers. */}
          {others.length > 0 ? (
            <span className="flex items-center gap-1.5 pt-0.5">
              <span className="flex -space-x-1">
                {others.slice(0, 3).map((a) => (
                  <AvatarBadge key={a.id} person={a.volunteer} size="sm" className="ring-2 ring-card" />
                ))}
              </span>
              <span className="sr-only text-xs text-muted-foreground @min-[17rem]/card:not-sr-only">
                {others.slice(0, 2).map((a) => a.volunteer.firstName).join(", ")}
                {others.length > 2 ? ` and\u00a0${others.length - 2}\u00a0more` : ""}
              </span>
              {crewCount("ml-auto inline-flex @min-[17rem]/card:hidden")}
            </span>
          ) : (
            crewCount("inline-flex self-end @min-[17rem]/card:hidden")
          )}
          {locked && reason && <span className="text-sm leading-snug text-status-neutral">{reason}</span>}
        </span>
      </span>
    </Link>
  );
}
