"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { updateShiftType } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OptionSelect } from "@/components/shared/option-select";
import { TIMES } from "@/components/admin/training-admin-controls";

export type ShiftTypeForm = {
  id: string;
  name: string;
  workingWith: string;
  startTime: string;
  endTime: string;
  capacity: number;
  needed: number;
  lastMinuteHours: number;
  escalateHours: number;
};

function NumberField({ id, label, hint, unit, value, min, max, onChange }: { id: string; label: string; hint?: string; unit?: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input id={id} type="number" inputMode="numeric" min={min} max={max} value={Number.isNaN(value) ? "" : value} onChange={(e) => onChange(e.target.valueAsNumber)} aria-describedby={hint ? `${id}-hint` : undefined} className="h-11 bg-card pr-16 text-base tabular" />
        {unit && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{unit}</span>}
      </div>
      {hint && <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function ShiftTypeEditor({ shiftType }: { shiftType: ShiftTypeForm }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(shiftType);
  const [pending, run] = useTransition();
  const router = useRouter();
  if (!open) {
    return <Button variant="outline" size="sm" className="h-9" onClick={() => { setV(shiftType); setOpen(true); }}><Pencil className="size-4" /> Configure</Button>;
  }
  const id = (k: string) => `st-${k}-${v.id}`;
  return (
    <form
      className="mt-3 grid gap-x-4 gap-y-5 rounded-xl border border-green/40 bg-green-tint-soft p-4 sm:grid-cols-2 lg:grid-cols-4"
      onSubmit={(e) => { e.preventDefault(); run(async () => { const r = await updateShiftType(v); if (r.ok) { toast.success(r.message); setOpen(false); router.refresh(); } else toast.error(r.error); }); }}
    >
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor={id("name")}>Name</Label>
        <Input id={id("name")} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} className="h-11 bg-card text-base" />
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor={id("with")}>Working with</Label>
        <Input id={id("with")} value={v.workingWith} placeholder="e.g. Dave (staff driver)" aria-describedby={`${id("with")}-hint`} onChange={(e) => setV({ ...v, workingWith: e.target.value })} className="h-11 bg-card text-base" />
        <p id={`${id("with")}-hint`} className="text-xs text-muted-foreground">Shown to volunteers on the shift so they know who to look for.</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={id("start")}>Start</Label>
        <OptionSelect id={id("start")} value={v.startTime} onValueChange={(startTime) => setV({ ...v, startTime })} options={TIMES} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={id("end")}>End</Label>
        <OptionSelect id={id("end")} value={v.endTime} onValueChange={(endTime) => setV({ ...v, endTime })} options={TIMES.filter((t) => t.value > v.startTime)} />
      </div>
      <NumberField id={id("needed")} label="Minimum crew" min={1} max={40} value={v.needed} onChange={(needed) => setV({ ...v, needed })} hint="Fewer confirmed than this is a gap." />
      <NumberField id={id("cap")} label="Maximum crew" min={1} max={40} value={v.capacity} onChange={(capacity) => setV({ ...v, capacity })} />
      <fieldset className="grid gap-x-4 gap-y-5 rounded-lg border border-border bg-card p-4 sm:col-span-2 sm:grid-cols-2 lg:col-span-4">
        <legend className="px-1 text-sm font-semibold text-ink">Last-minute cover</legend>
        <NumberField id={id("lm")} label="Notify last-minute volunteers" unit="hours" min={0} max={168} value={v.lastMinuteHours} onChange={(lastMinuteHours) => setV({ ...v, lastMinuteHours })} hint="When a gap opens this close to the start, eligible volunteers who opted in get a push notification. 0 turns it off." />
        <NumberField id={id("esc")} label="Alert the coordinator" unit="hours" min={0} max={168} value={v.escalateHours} onChange={(escalateHours) => setV({ ...v, escalateHours })} hint="Still uncovered this close to the start: you get an email to step in. 0 turns it off." />
      </fieldset>
      <p className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-4">Times and crew sizes apply to shifts scheduled from now on. Shifts already on the roster keep theirs.</p>
      <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
        <Button type="submit" size="sm" className="h-10 px-4" disabled={pending}>{pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Save shift type</Button>
        <Button type="button" variant="ghost" size="sm" className="h-10 px-4" onClick={() => setOpen(false)}><X className="size-4" /> Cancel</Button>
      </div>
    </form>
  );
}
