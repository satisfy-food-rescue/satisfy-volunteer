import { BellRing, Clock, Smartphone, UserRound, Users } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { formatTimeRange, WEEKDAY_SHORT } from "@/lib/dates";
import { SHIFT_KIND_LABEL, type ShiftKind } from "@/lib/domain";
import { PageHeader } from "@/components/shared/page-header";
import { ShiftKindIcon } from "@/components/app/shift-card";
import { ShiftTypeEditor } from "@/components/admin/shift-type-editor";
import { cn } from "@/lib/utils";

export const metadata = { title: "Shift types" };

function hoursLabel(h: number) {
  if (h === 0) return "Off";
  return h % 24 === 0 ? `${h / 24} ${h === 24 ? "day" : "days"} before` : `${h} hours before`;
}

export default async function ShiftTypesPage() {
  await requireAdmin();
  const templates = await db.shiftTemplate.findMany({ where: { active: true }, include: { route: true }, orderBy: { order: "asc" } });
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader eyebrow="Roster" title="Shift types" description="Names, times, crew sizes and who volunteers work with. Last-minute thresholds are set per shift type, so route shifts can call for cover earlier than the warehouse." />
      <div className="flex flex-col gap-3">
        {templates.map((t) => (
          <article key={t.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-start gap-4">
              <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-xl", t.kind === "WAREHOUSE" ? "bg-green-tint text-green-deep" : "bg-blue-tint text-blue-text")}>
                <ShiftKindIcon kind={t.kind} className="size-6" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-xl text-ink">{t.name}</h2>
                <p className="text-sm text-muted-foreground">{SHIFT_KIND_LABEL[t.kind as ShiftKind]}{t.route ? ` · ${t.route.name} route` : ""} · {t.weekdays.split(",").map((d) => WEEKDAY_SHORT[Number(d)]).join(", ")}</p>
                <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-soft">
                  <div className="inline-flex items-center gap-1.5"><dt className="sr-only">Time</dt><Clock className="size-4 text-green-text" aria-hidden /><dd className="tabular">{formatTimeRange(t.startTime, t.endTime)}</dd></div>
                  <div className="inline-flex items-center gap-1.5"><dt className="sr-only">Crew</dt><Users className="size-4 text-green-text" aria-hidden /><dd className="tabular">{t.needed === t.capacity ? `${t.needed} needed` : `${t.needed} to ${t.capacity} volunteers`}</dd></div>
                  <div className="inline-flex items-center gap-1.5"><dt className="sr-only">Working with</dt><UserRound className="size-4 text-green-text" aria-hidden /><dd>{t.workingWith ? `With ${t.workingWith}` : <span className="text-muted-foreground">Nobody set</span>}</dd></div>
                </dl>
              </div>
              <dl className="grid w-full grid-cols-2 gap-2 sm:w-auto">
                <div className="rounded-xl bg-pink-tint px-3 py-2">
                  <dt className="flex items-center gap-1.5 text-xs font-semibold text-pink-text"><Smartphone className="size-3.5" aria-hidden /> Push to last-minute</dt>
                  <dd className="font-display text-base font-bold text-ink tabular">{hoursLabel(t.lastMinuteHours)}</dd>
                </div>
                <div className="rounded-xl bg-status-warn-bg px-3 py-2">
                  <dt className="flex items-center gap-1.5 text-xs font-semibold text-status-warn"><BellRing className="size-3.5" aria-hidden /> Alert coordinator</dt>
                  <dd className="font-display text-base font-bold text-ink tabular">{hoursLabel(t.escalateHours)}</dd>
                </div>
              </dl>
            </div>
            <div className="mt-3">
              <ShiftTypeEditor shiftType={{ id: t.id, name: t.name, workingWith: t.workingWith ?? "", startTime: t.startTime, endTime: t.endTime, capacity: t.capacity, needed: t.needed, lastMinuteHours: t.lastMinuteHours, escalateHours: t.escalateHours }} />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
