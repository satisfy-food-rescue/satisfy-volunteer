import Link from "next/link";
import { CheckCircle2, ChevronRight, GraduationCap, History, MapPin } from "lucide-react";
import type { SessionView } from "@/lib/sessions";
import { formatTimeRange } from "@/lib/dates";
import { Chip } from "@/components/shared/status-chip";
import { cn } from "@/lib/utils";

/** A training session the volunteer is booked into, on their week beside
 *  their shifts. Shaped like a shift card, in the teal of training. */
export function SessionCard({ view, past = false }: { view: SessionView; past?: boolean }) {
  return (
    <Link
      href="/app/training#sessions"
      className={cn("group @container/card block rounded-2xl border border-teal/40 transition-colors hover:border-teal", past ? "bg-card/60" : "bg-card shadow-sm")}
    >
      <span className="flex items-stretch gap-3 p-3.5 @min-[17rem]/card:p-4">
        <span className="hidden w-11 shrink-0 items-center justify-center rounded-xl bg-teal-tint text-teal-deep @min-[17rem]/card:flex">
          <GraduationCap className="size-6" aria-hidden />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="flex items-start justify-between gap-2">
            <span className="min-w-0">
              <span className="block text-xs font-bold uppercase tracking-wide text-teal">Training</span>
              <span className="line-clamp-3 font-bold text-ink @min-[17rem]/card:line-clamp-2">{view.session.module.name}</span>
              <span className="block text-sm text-muted-foreground tabular">{formatTimeRange(view.startTime, view.endTime)}</span>
              <span className="mt-0.5 flex items-start gap-1 text-sm text-muted-foreground">
                <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                <span className="line-clamp-1">{view.session.location}</span>
              </span>
            </span>
            <ChevronRight className="mt-1 hidden size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 @min-[17rem]/card:block" aria-hidden />
          </span>
          <span className="flex flex-wrap items-center gap-2">
            {past ? (
              <Chip tone="neutral" icon={History} size="sm">You were booked in</Chip>
            ) : (
              <Chip tone="info" icon={CheckCircle2} size="sm">You&apos;re booked in</Chip>
            )}
          </span>
        </span>
      </span>
    </Link>
  );
}
