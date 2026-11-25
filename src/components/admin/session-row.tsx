import Link from "next/link";
import { GraduationCap } from "lucide-react";
import type { SessionView } from "@/lib/sessions";
import { formatTimeRange } from "@/lib/dates";
import { AvatarBadge } from "@/components/shared/avatar-badge";
import { Chip } from "@/components/shared/status-chip";

/** A training session in a list of shifts, such as today's roster: laid out
 *  like a shift row, in the teal of training. */
export function SessionRow({ view }: { view: SessionView }) {
  return (
    <Link href={`/admin/training/sessions/${view.session.id}`} className="@container/row flex items-center gap-3 rounded-xl border border-teal/40 bg-card px-3 py-2.5 transition-colors hover:border-teal">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-teal-tint text-teal-deep">
        <GraduationCap className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-sm font-bold text-ink">
          <span className="sr-only">Training: </span>
          {view.session.module.name}
        </span>
        <span className="block text-xs text-muted-foreground tabular">
          {formatTimeRange(view.startTime, view.endTime)} · {view.session.location}
        </span>
      </span>
      <span className="hidden shrink-0 -space-x-1 @xl/row:flex">
        {view.going.slice(0, 5).map((v) => <AvatarBadge key={v.id} person={v} size="sm" className="size-7 text-[0.6rem] ring-2 ring-card" />)}
      </span>
      <span className="w-10 shrink-0 text-right text-sm text-ink tabular">{view.going.length}/{view.session.capacity}</span>
      <span className="w-24 shrink-0 text-right @md/row:w-28">
        <Chip tone="info" icon={GraduationCap} size="sm">Training</Chip>
      </span>
    </Link>
  );
}
