"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarRange, Check, Loader2, Pencil } from "lucide-react";
import { bulkSchedule, type BulkResult } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { addDays, formatDay, formatTimeRange, WEEKDAY_SHORT } from "@/lib/dates";
import { cn } from "@/lib/utils";

type TemplateLite = { id: string; name: string; startTime: string; endTime: string; capacity: number; needed: number; weekdays: string; regulars: number };

export function BulkScheduler({ templates, today }: { templates: TemplateLite[]; today: string }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set(templates.map((t) => t.id)));
  const [startDate, setStartDate] = useState(addDays(today, 56));
  const [endDate, setEndDate] = useState(addDays(today, 84));
  const [weekdays, setWeekdays] = useState<Set<number>>(new Set([1, 2, 3, 4, 5]));
  const [assignRegulars, setAssignRegulars] = useState(true);
  const [preview, setPreview] = useState<Extract<BulkResult, { ok: true; committed: false }> | null>(null);
  const [pending, start] = useTransition();

  const invalidate = () => setPreview(null);
  const toggle = <T,>(set: Set<T>, v: T) => { const n = new Set(set); if (n.has(v)) n.delete(v); else n.add(v); return n; };
  const canRun = selected.size > 0 && weekdays.size > 0 && startDate && endDate && endDate >= startDate;

  function run(dryRun: boolean) {
    if (!canRun) return;
    start(async () => {
      const result = await bulkSchedule({ templateIds: [...selected], startDate, endDate, weekdays: [...weekdays], assignRegulars, dryRun });
      if (!result.ok) return void toast.error(result.error);
      if (result.committed) {
        toast.success(`Created ${result.created} shifts and ${result.assignments} regular assignments.`);
        router.push(`/admin/roster?view=month&date=${startDate}`);
        router.refresh();
        return;
      }
      setPreview(result);
    });
  }

  const previewByDate = useMemo(() => {
    if (!preview) return [];
    const m = new Map<string, typeof preview.rows>();
    for (const r of preview.rows) m.set(r.iso, [...(m.get(r.iso) ?? []), r]);
    return [...m.entries()];
  }, [preview]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <div className="flex flex-col gap-6 lg:col-span-2">
        <fieldset className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
          <legend className="font-display px-1 text-sm font-bold uppercase tracking-wide text-muted-foreground">Shift templates</legend>
          {templates.map((t) => (
            <label key={t.id} className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors", selected.has(t.id) ? "border-green bg-green-tint-soft" : "border-border hover:bg-muted")}>
              <input type="checkbox" className="mt-1 size-4 accent-[var(--brand-green)]" checked={selected.has(t.id)} onChange={() => { invalidate(); setSelected(toggle(selected, t.id)); }} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-ink">{t.name}</span>
                <span className="block text-xs text-muted-foreground tabular">
                  {formatTimeRange(t.startTime, t.endTime)} · {t.weekdays.split(",").map((d) => WEEKDAY_SHORT[Number(d)]).join(" ")} · capacity {t.capacity}, min {t.needed} · {t.regulars} regulars
                </span>
              </span>
            </label>
          ))}
        </fieldset>

        <fieldset className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4">
          <legend className="font-display px-1 text-sm font-bold uppercase tracking-wide text-muted-foreground">Date range</legend>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bs-start">From</Label>
              <DatePicker id="bs-start" min={today} value={startDate} onChange={(d) => { invalidate(); setStartDate(d); if (d > endDate) setEndDate(d); }} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bs-end">To</Label>
              <DatePicker id="bs-end" min={startDate} value={endDate} onChange={(d) => { invalidate(); setEndDate(d); }} />
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium">Repeat on</p>
            <div className="grid grid-cols-5 gap-1.5">
              {[1, 2, 3, 4, 5].map((d) => (
                <label key={d} className={cn("flex h-11 cursor-pointer items-center justify-center rounded-lg border text-sm font-bold transition-colors has-focus-visible:outline-3 has-focus-visible:outline-green", weekdays.has(d) ? "border-green bg-green-tint text-green-deep" : "border-border text-muted-foreground hover:bg-muted")}>
                  <input type="checkbox" className="sr-only" checked={weekdays.has(d)} onChange={() => { invalidate(); setWeekdays(toggle(weekdays, d)); }} />
                  {WEEKDAY_SHORT[d]}
                </label>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">Satisfy runs Monday to Friday, so weekends are never offered.</p>
          </div>
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" className="mt-1 size-4 accent-[var(--brand-green)]" checked={assignRegulars} onChange={(e) => { invalidate(); setAssignRegulars(e.target.checked); }} />
            <span className="text-sm text-ink">Roster regular volunteers onto their usual weekday automatically</span>
          </label>
        </fieldset>

        <div className="flex flex-wrap gap-2">
          <Button size="lg" variant={preview ? "outline" : "default"} className="h-11" disabled={!canRun || pending} onClick={() => run(true)}>
            {pending && !preview ? <Loader2 className="size-4 animate-spin" /> : <CalendarRange className="size-4" />} Preview
          </Button>
          {preview && (
            <Button size="lg" className="h-11" disabled={pending || preview.toCreate === 0} onClick={() => run(false)}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Create {preview.toCreate} shifts
            </Button>
          )}
        </div>
      </div>

      <div className="lg:col-span-3">
        {!preview ? (
          <div className="flex h-full min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/60 p-8 text-center">
            <Pencil className="size-8 text-muted-foreground" aria-hidden />
            <p className="mt-3 font-bold text-ink">Nothing is created until you confirm</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">Preview shows exactly which shifts will be created, which already exist and are skipped, and how many regulars are rostered on.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-3">
              {[
                ["To create", preview.toCreate, "text-green-text"],
                ["Already exist", preview.skipped, "text-muted-foreground"],
                ["Regulars rostered", preview.assignments, "text-ink"],
              ].map(([l, n, c]) => (
                <div key={l as string} className="rounded-2xl border border-border bg-card p-3">
                  <p className={cn("font-display font-bold text-2xl tabular", c as string)}>{n as number}</p>
                  <p className="text-xs font-semibold text-muted-foreground">{l as string}</p>
                </div>
              ))}
            </div>
            <div className="max-h-[32rem] overflow-y-auto rounded-2xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="font-display sticky top-0 bg-muted/90 text-left text-xs uppercase tracking-wide text-muted-foreground backdrop-blur">
                  <tr><th className="px-3 py-2 font-bold">Date</th><th className="px-3 py-2 font-bold">Shift</th><th className="px-3 py-2 text-right font-bold">Regulars</th><th className="px-3 py-2 text-right font-bold">Status</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {previewByDate.map(([iso, rows]) =>
                    rows.map((r, i) => (
                      <tr key={r.templateId + iso} className={cn(r.exists && "text-muted-foreground")}>
                        <td className="px-3 py-2 font-semibold tabular">{i === 0 ? formatDay(iso) : ""}</td>
                        <td className="px-3 py-2">{r.templateName}</td>
                        <td className="px-3 py-2 text-right tabular">{r.exists ? "" : r.regulars}</td>
                        <td className="px-3 py-2 text-right">{r.exists ? <span className="text-xs">Exists, skipped</span> : <span className="text-xs font-bold text-green-text">Will create</span>}</td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
