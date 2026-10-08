import Link from "next/link";
import { ChevronRight, CheckCircle2, HandHelping, Lock, Users } from "lucide-react";
import type { ShiftView } from "@/lib/roster";
import { formatTimeRange } from "@/lib/dates";
import { Chip } from "@/components/shared/status-chip";
import { AvatarBadge } from "@/components/shared/avatar-badge";
import { cn } from "@/lib/utils";

export function ShiftKindIcon({ kind, className }: { kind: string; className?: string }) {
  const cls = cn("size-5", className);
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
  reason,
}: {
  view: ShiftView;
  meId: string;
  eligible: boolean;
  reason: string | null;
}) {
  const mine = view.confirmed.find((a) => a.volunteerId === meId);
  const others = view.confirmed.filter((a) => a.volunteerId !== meId);
  return (
    <Link
      href={`/app/shifts/${view.shift.id}`}
      className={cn(
        "group flex items-stretch gap-3 rounded-2xl border bg-card p-4 shadow-sm transition-colors hover:border-teal/60",
        mine ? "border-green/60" : "border-border",
        view.isGap && !mine && "border-orange/60",
      )}
    >
      <span
        className={cn(
          "flex w-11 shrink-0 items-center justify-center rounded-xl",
          view.kind === "WAREHOUSE" ? "bg-green-tint text-green-deep" : "bg-sky-tint text-sky-text",
        )}
      >
        <ShiftKindIcon kind={view.kind} className="size-6" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex items-start justify-between gap-2">
          <span className="min-w-0">
            <span className="block truncate font-bold text-ink">{view.shift.template.name}</span>
            <span className="block text-sm text-muted-foreground tabular">{formatTimeRange(view.shift.startTime, view.shift.endTime)}</span>
          </span>
          <ChevronRight className="mt-1 size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
        </span>
        <span className="flex flex-wrap items-center gap-2">
          {mine ? (
            <Chip tone="good" icon={CheckCircle2} size="sm">{mine.source === "REGULAR" ? "Your regular slot" : "You're on"}</Chip>
          ) : view.isGap ? (
            <Chip tone="bad" icon={HandHelping} size="sm">Needs cover</Chip>
          ) : view.isFull ? (
            <Chip tone="neutral" size="sm">Full</Chip>
          ) : null}
          {!mine && !eligible && <Chip tone="warn" icon={Lock} size="sm">Training needed</Chip>}
          <span className="ml-auto inline-flex items-center gap-1.5 text-sm text-muted-foreground tabular">
            <Users className="size-4" aria-hidden />
            {view.confirmedCount}/{view.shift.capacity}
          </span>
        </span>
        {others.length > 0 && (
          <span className="flex items-center gap-1.5 pt-0.5">
            <span className="flex -space-x-1">
              {others.slice(0, 4).map((a) => (
                <AvatarBadge key={a.id} person={a.volunteer} size="sm" className="ring-2 ring-card" />
              ))}
            </span>
            <span className="text-xs text-muted-foreground">
              {others.slice(0, 2).map((a) => a.volunteer.firstName).join(", ")}
              {others.length > 2 ? ` and ${others.length - 2} more` : ""}
            </span>
          </span>
        )}
        {!mine && !eligible && reason && (
          <span className="text-sm leading-snug text-status-warn">{reason}</span>
        )}
      </span>
    </Link>
  );
}
