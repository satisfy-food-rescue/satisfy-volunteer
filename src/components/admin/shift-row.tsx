import Link from "next/link";
import { HandHelping, CheckCircle2, Ban, PencilLine, Users } from "lucide-react";
import type { ShiftView } from "@/lib/roster";
import { formatTimeRange } from "@/lib/dates";
import { Chip } from "@/components/shared/status-chip";
import { AvatarBadge } from "@/components/shared/avatar-badge";
import { ShiftKindIcon, kindTileClass } from "@/components/app/shift-card";
import { isAdHocKind } from "@/lib/domain";
import { cn } from "@/lib/utils";

export function ShiftStatusChip({ view }: { view: ShiftView }) {
  if (view.shift.status === "CANCELLED") return <Chip tone="neutral" icon={Ban} size="sm">Cancelled</Chip>;
  if (view.isDraft) return <Chip tone="info" icon={PencilLine} size="sm">Draft</Chip>;
  if (view.isGap) return <Chip tone="warn" icon={HandHelping} size="sm">Needs {view.shortBy}</Chip>;
  // An ad hoc shift short of crew is open, not a gap to cover.
  // Green outline, as on the dashboard's coverage board key.
  if (isAdHocKind(view.kind) && view.shortBy > 0) return <Chip tone="good" icon={Users} size="sm" className="border border-green/70 bg-card text-green-deep">{view.shortBy} to fill</Chip>;
  return <Chip tone="good" icon={CheckCircle2} size="sm">{isAdHocKind(view.kind) ? "Filled" : "Covered"}</Chip>;
}

export function ShiftRow({ view, showDate, note }: { view: ShiftView; showDate?: string; /** Why it matters, e.g. who is away. */ note?: string }) {
  const cancelled = view.shift.status === "CANCELLED";
  return (
    <Link
      href={`/admin/roster/${view.shift.id}`}
      className={cn(
        "@container/row flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 transition-colors hover:border-teal/60",
        view.isGap ? "border-orange/60" : view.isDraft ? "border-dashed border-teal/60" : "border-border",
        cancelled && "opacity-60",
      )}
    >
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", kindTileClass(view.kind))}>
        <ShiftKindIcon kind={view.kind} className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-sm font-bold text-ink">{view.name}</span>
        <span className="block text-xs text-muted-foreground tabular">
          {/* The date shares the time's line so a narrow column never cuts it off. */}
          {showDate && <span className="font-semibold text-ink-soft">{showDate}, </span>}
          {formatTimeRange(view.shift.startTime, view.shift.endTime)}
        </span>
        {note && <span className="mt-0.5 block text-xs text-status-warn">{note}</span>}
      </span>
      {/* Sized by the row, not the viewport: the dashboard puts rows in a narrow column. */}
      <span className="hidden shrink-0 -space-x-1 @xl/row:flex">
        {view.confirmed.slice(0, 5).map((a) => <AvatarBadge key={a.id} person={a.volunteer} size="sm" className="size-7 text-[0.6rem] ring-2 ring-card" />)}
      </span>
      <span className="w-10 shrink-0 text-right text-sm text-ink tabular">{view.confirmedCount}/{view.shift.capacity}</span>
      <span className="w-24 shrink-0 text-right @md/row:w-28">
        <ShiftStatusChip view={view} />
      </span>
    </Link>
  );
}
