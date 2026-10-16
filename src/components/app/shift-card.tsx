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

export function ShiftCard({
  view,
  meId,
  eligible,
  needsRole,
  reason,
  showDate = false,
  past = false,
  showReason = true,
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
  /** Off where the page explains the lock once for every card. */
  showReason?: boolean;
}) {
  const mine = view.confirmed.find((a) => a.volunteerId === meId);
  const cancelled = view.shift.status === "CANCELLED";
  const others = view.confirmed.filter((a) => a.volunteerId !== meId);
  const locked = !cancelled && !mine && !eligible && !past;
  return (
    <Link
      href={`/app/shifts/${view.shift.id}`}
      className={cn(
        "group flex items-stretch gap-3 rounded-2xl border p-4 transition-colors hover:border-teal/60",
        past ? "bg-card/60" : "bg-card shadow-sm",
        mine && !past ? "border-green/60" : "border-border",
        view.isGap && !mine && !past && "border-orange/60",
      )}
    >
      <span className={cn("flex w-11 shrink-0 items-center justify-center rounded-xl", kindTileClass(view.kind))}>
        <ShiftKindIcon kind={view.kind} className="size-6" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex items-start justify-between gap-2">
          <span className="min-w-0">
            <span className="line-clamp-2 font-bold text-ink">{view.name}</span>
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
          <ChevronRight className="mt-1 size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
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
          <span className="ml-auto inline-flex items-center gap-1.5 text-sm text-muted-foreground tabular">
            <Users className="size-4" aria-hidden />
            {view.confirmedCount}/{view.shift.capacity}
          </span>
        </span>
        {others.length > 0 && (
          <span className="flex items-center gap-1.5 pt-0.5">
            <span className="flex -space-x-1">
              {others.slice(0, 3).map((a) => (
                <AvatarBadge key={a.id} person={a.volunteer} size="sm" className="ring-2 ring-card" />
              ))}
            </span>
            <span className="text-xs text-muted-foreground">
              {others.slice(0, 2).map((a) => a.volunteer.firstName).join(", ")}
              {others.length > 2 ? ` and\u00a0${others.length - 2}\u00a0more` : ""}
            </span>
          </span>
        )}
        {locked && showReason && reason && (
          <span className="text-sm leading-snug text-status-warn">{reason}</span>
        )}
      </span>
    </Link>
  );
}
