import Link from "next/link";
import { HandHelping, CheckCircle2, Ban } from "lucide-react";
import type { ShiftView } from "@/lib/roster";
import { formatTimeRange } from "@/lib/dates";
import { Chip } from "@/components/shared/status-chip";
import { AvatarBadge } from "@/components/shared/avatar-badge";
import { ShiftKindIcon } from "@/components/app/shift-card";
import { cn } from "@/lib/utils";

export function ShiftRow({ view, showDate }: { view: ShiftView; showDate?: string }) {
  const cancelled = view.shift.status === "CANCELLED";
  return (
    <Link
      href={`/admin/roster/${view.shift.id}`}
      className={cn(
        "flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 transition-colors hover:border-teal/60",
        view.isGap ? "border-orange/60" : "border-border",
        cancelled && "opacity-60",
      )}
    >
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", view.kind === "WAREHOUSE" ? "bg-green-tint text-green-deep" : "bg-sky-tint text-sky-text")}>
        <ShiftKindIcon kind={view.kind} className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-ink">
          {showDate && <span className="mr-2 text-muted-foreground">{showDate}</span>}
          {view.shift.template.name}
        </span>
        <span className="block text-xs text-muted-foreground tabular">{formatTimeRange(view.shift.startTime, view.shift.endTime)}</span>
      </span>
      <span className="hidden -space-x-1 sm:flex">
        {view.confirmed.slice(0, 5).map((a) => <AvatarBadge key={a.id} person={a.volunteer} size="sm" className="size-7 text-[0.6rem] ring-2 ring-card" />)}
      </span>
      <span className="w-12 text-right text-sm text-ink tabular">{view.confirmedCount}/{view.shift.capacity}</span>
      <span className="w-28 text-right">
        {cancelled ? (
          <Chip tone="neutral" icon={Ban} size="sm">Cancelled</Chip>
        ) : view.isGap ? (
          <Chip tone="bad" icon={HandHelping} size="sm">Needs {view.shortBy}</Chip>
        ) : (
          <Chip tone="good" icon={CheckCircle2} size="sm">Covered</Chip>
        )}
      </span>
    </Link>
  );
}
