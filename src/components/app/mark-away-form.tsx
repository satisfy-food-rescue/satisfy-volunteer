"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarOff, Loader2, Palmtree, Thermometer, HelpCircle } from "lucide-react";
import { markAway } from "@/app/app/actions";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDay } from "@/lib/dates";
import { cn } from "@/lib/utils";

const REASONS = [
  { value: "HOLIDAY", label: "Holiday", icon: Palmtree },
  { value: "SICK", label: "Sick", icon: Thermometer },
  { value: "OTHER", label: "Other", icon: HelpCircle },
] as const;

export function MarkAwayForm({
  today,
  upcoming,
}: {
  today: string;
  upcoming: { iso: string; name: string }[];
}) {
  const router = useRouter();
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [reason, setReason] = useState<(typeof REASONS)[number]["value"]>("HOLIDAY");
  const [note, setNote] = useState("");
  const [pending, run] = useTransition();

  const affected = useMemo(
    () => upcoming.filter((u) => u.iso >= start && u.iso <= end),
    [upcoming, start, end],
  );
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end) && end >= start && start >= today;

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        run(async () => {
          const result = await markAway({ startDate: start, endDate: end, reason, note });
          if (result.ok) {
            toast.success(result.message);
            router.refresh();
            setNote("");
          } else toast.error(result.error);
        });
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="away-start" className="text-base">From</Label>
          <DatePicker id="away-start" min={today} value={start} onChange={(v) => { setStart(v); if (v > end) setEnd(v); }} className="h-12" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="away-end" className="text-base">To</Label>
          <DatePicker id="away-end" min={start} value={end} onChange={setEnd} className="h-12" />
        </div>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-base font-medium">Reason</legend>
        <div className="grid grid-cols-3 gap-2">
          {REASONS.map((r) => (
            <label
              key={r.value}
              className={cn(
                "flex min-h-14 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2 text-sm font-bold transition-colors has-focus-visible:outline-3 has-focus-visible:outline-ring",
                reason === r.value ? "border-teal bg-teal-tint text-teal-deep" : "border-border bg-card text-ink hover:bg-muted",
              )}
            >
              <input type="radio" name="reason" value={r.value} checked={reason === r.value} onChange={() => setReason(r.value)} className="sr-only" />
              <r.icon className="size-5" aria-hidden />
              {r.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="away-note" className="text-base">Note for the coordinator <span className="font-normal text-muted-foreground">(optional)</span></Label>
        <Textarea id="away-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} rows={2} className="text-base" placeholder="e.g. Back on the Monday" />
      </div>

      <div className={cn("rounded-xl px-4 py-3 text-sm", affected.length ? "bg-status-warn-bg text-status-warn" : "bg-muted text-muted-foreground")}>
        {affected.length === 0 ? (
          <p>No regular shifts fall in this range.</p>
        ) : (
          <>
            <p className="font-bold">This releases {affected.length} {affected.length === 1 ? "shift" : "shifts"} for cover:</p>
            <ul className="mt-1 list-disc pl-5">
              {affected.slice(0, 6).map((a) => (
                <li key={a.iso + a.name}>{formatDay(a.iso)}, {a.name}</li>
              ))}
              {affected.length > 6 && <li>and {affected.length - 6} more</li>}
            </ul>
          </>
        )}
      </div>

      <Button type="submit" size="lg" className="h-12 text-base" disabled={!valid || pending}>
        {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <CalendarOff className="size-5" aria-hidden />}
        Mark me away
      </Button>
    </form>
  );
}
