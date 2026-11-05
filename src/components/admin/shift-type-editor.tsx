"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Archive, ArchiveRestore, Check, Loader2, Pencil, Plus, X } from "lucide-react";
import { createShiftType, setShiftTypeActive, updateShiftType, type NewShiftTypeInput } from "@/app/admin/actions";
import { ActionButton } from "@/components/app/action-button";
import { SHIFT_KIND_LABEL, VOLUNTEER_ROLES, isAdHocKind, type ShiftKind } from "@/lib/domain";
import { WEEKDAY_SHORT } from "@/lib/dates";
import { cn } from "@/lib/utils";
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

/** `adHoc` (harvests): never a cover gap, so the last-minute rules do not apply. */
export function ShiftTypeEditor({ shiftType, adHoc = false }: { shiftType: ShiftTypeForm; adHoc?: boolean }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(shiftType);
  const [pending, run] = useTransition();
  const router = useRouter();
  if (!open) {
    return <Button variant="outline" size="sm" className="h-9" onClick={() => { setV(shiftType); setOpen(true); }}><Pencil className="size-4" /> Edit shift type</Button>;
  }
  const id = (k: string) => `st-${k}-${v.id}`;
  return (
    <form
      className="grid w-full basis-full gap-x-4 gap-y-5 rounded-xl border border-teal/25 bg-teal-tint-soft p-4 @xl/admin:grid-cols-2 @4xl/admin:grid-cols-4"
      onSubmit={(e) => { e.preventDefault(); run(async () => { const r = await updateShiftType(v); if (r.ok) { toast.success(r.message); setOpen(false); router.refresh(); } else toast.error(r.error); }); }}
    >
      <div className="flex flex-col gap-1.5 @xl/admin:col-span-2">
        <Label htmlFor={id("name")}>Name</Label>
        <Input id={id("name")} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} className="h-11 bg-card text-base" />
      </div>
      <div className="flex flex-col gap-1.5 @xl/admin:col-span-2">
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
      <NumberField id={id("needed")} label="Minimum crew" min={1} max={40} value={v.needed} onChange={(needed) => setV({ ...v, needed })} hint={adHoc ? "How many a new one asks for." : "Fewer confirmed than this is a gap."} />
      <NumberField id={id("cap")} label="Maximum crew" min={1} max={40} value={v.capacity} onChange={(capacity) => setV({ ...v, capacity })} />
      {!adHoc && (
        <fieldset className="grid gap-x-4 gap-y-5 rounded-lg border border-border bg-card p-4 @xl/admin:col-span-2 @xl/admin:grid-cols-2 @4xl/admin:col-span-4">
          <legend className="px-1 text-sm font-semibold text-ink">Last-minute cover</legend>
          <NumberField id={id("lm")} label="Notify last-minute volunteers" unit="hours" min={0} max={168} value={v.lastMinuteHours} onChange={(lastMinuteHours) => setV({ ...v, lastMinuteHours })} hint="When a gap opens this close to the start, eligible volunteers who opted in get a push notification. 0 turns it off." />
          <NumberField id={id("esc")} label="Alert the coordinator" unit="hours" min={0} max={168} value={v.escalateHours} onChange={(escalateHours) => setV({ ...v, escalateHours })} hint="Still uncovered this close to the start: you get an email to step in. 0 turns it off." />
        </fieldset>
      )}
      <p className="text-xs text-muted-foreground @xl/admin:col-span-2 @4xl/admin:col-span-4">Times and crew sizes apply to shifts {adHoc ? "planned" : "scheduled"} from now on. Shifts already on the roster keep theirs.</p>
      <div className="flex gap-2 @xl/admin:col-span-2 @4xl/admin:col-span-4">
        <Button type="submit" size="sm" className="h-10 px-4" disabled={pending}>{pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Save shift type</Button>
        <Button type="button" variant="ghost" size="sm" className="h-10 px-4" onClick={() => setOpen(false)}><X className="size-4" /> Cancel</Button>
      </div>
    </form>
  );
}

const ROUTE_KINDS: ShiftKind[] = ["DRIVERS_ASSISTANT", "VOLUNTEER_DRIVER"];
const NO_ROUTE = "none";

function blankType(kind: ShiftKind): NewShiftTypeInput {
  const route = ROUTE_KINDS.includes(kind);
  return { kind, name: "", routeId: null, workingWith: "", startTime: "09:00", endTime: "12:00", capacity: route ? 1 : 8, needed: route ? 1 : 4, weekdays: isAdHocKind(kind) ? [] : [1, 2, 3, 4, 5], lastMinuteHours: route ? 72 : 48, escalateHours: route ? 36 : 24 };
}

/** Sets up a new shift type, such as a harvest for one group of volunteers
 *  or a sorting session on a new day. */
export function NewShiftType({ routes }: { routes: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<NewShiftTypeInput>(() => blankType("HARVEST"));
  const [pending, run] = useTransition();
  const router = useRouter();
  if (!open) {
    return <Button size="lg" className="self-start" onClick={() => { setV(blankType("HARVEST")); setOpen(true); }}><Plus className="size-4" aria-hidden /> Add a shift type</Button>;
  }
  const adHoc = isAdHocKind(v.kind);
  const routed = ROUTE_KINDS.includes(v.kind);
  const id = (k: string) => `nst-${k}`;
  return (
    <form
      className="grid gap-x-4 gap-y-5 rounded-2xl border border-teal/30 bg-teal-tint-soft p-4 @xl/admin:grid-cols-2 @4xl/admin:grid-cols-4"
      onSubmit={(e) => { e.preventDefault(); run(async () => { const r = await createShiftType(v); if (r.ok) { toast.success(r.message); setOpen(false); router.refresh(); } else toast.error(r.error); }); }}
    >
      <h2 className="text-xl text-ink @xl/admin:col-span-2 @4xl/admin:col-span-4">New shift type</h2>
      <div className="flex flex-col gap-1.5 @xl/admin:col-span-2">
        <Label htmlFor={id("kind")}>Kind</Label>
        <OptionSelect id={id("kind")} value={v.kind} onValueChange={(kind) => setV({ ...blankType(kind), name: v.name, workingWith: v.workingWith })} options={VOLUNTEER_ROLES.map((k) => ({ value: k, label: SHIFT_KIND_LABEL[k] }))} aria-describedby={`${id("kind")}-hint`} />
        <p id={`${id("kind")}-hint`} className="text-xs text-muted-foreground">Decides who can book it (volunteers with that role) and which training it needs.</p>
      </div>
      <div className="flex flex-col gap-1.5 @xl/admin:col-span-2">
        <Label htmlFor={id("name")}>Name</Label>
        <Input id={id("name")} required value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} className="h-11 bg-card text-base" placeholder={adHoc ? "For example, Harvest: schools and corporates" : "For example, Warehouse sorting (PM)"} />
      </div>
      {routed && (
        <div className="flex flex-col gap-1.5 @xl/admin:col-span-2">
          <Label htmlFor={id("route")}>Route</Label>
          <OptionSelect id={id("route")} value={v.routeId ?? NO_ROUTE} onValueChange={(r) => setV({ ...v, routeId: r === NO_ROUTE ? null : r })} options={[{ value: NO_ROUTE, label: "No route" }, ...routes.map((r) => ({ value: r.id, label: r.name }))]} />
        </div>
      )}
      <div className={cn("flex flex-col gap-1.5", routed ? "@xl/admin:col-span-2" : "@xl/admin:col-span-2 @4xl/admin:col-span-4")}>
        <Label htmlFor={id("with")}>Working with</Label>
        <Input id={id("with")} value={v.workingWith} placeholder="e.g. a Satisfy harvest lead" onChange={(e) => setV({ ...v, workingWith: e.target.value })} className="h-11 bg-card text-base" />
      </div>
      {!adHoc && (
        <fieldset className="flex flex-col gap-2 @xl/admin:col-span-2 @4xl/admin:col-span-4">
          <legend className="mb-2 text-sm font-medium">Runs on</legend>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5].map((d) => {
              const on = v.weekdays.includes(d);
              return (
                <label key={d} className={cn("flex h-10 min-w-14 cursor-pointer items-center justify-center gap-1.5 rounded-full border px-3.5 font-display text-sm font-semibold transition-colors has-focus-visible:outline-3 has-focus-visible:outline-ring", on ? "border-teal bg-card text-teal-deep" : "border-border bg-card/60 text-muted-foreground hover:text-ink")}>
                  <input type="checkbox" className="sr-only" checked={on} onChange={() => setV({ ...v, weekdays: on ? v.weekdays.filter((x) => x !== d) : [...v.weekdays, d].sort() })} />
                  {on && <Check className="size-4 text-teal" aria-hidden />}
                  {WEEKDAY_SHORT[d]}
                </label>
              );
            })}
          </div>
        </fieldset>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={id("start")}>Start</Label>
        <OptionSelect id={id("start")} value={v.startTime} onValueChange={(startTime) => setV({ ...v, startTime })} options={TIMES} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={id("end")}>End</Label>
        <OptionSelect id={id("end")} value={v.endTime} onValueChange={(endTime) => setV({ ...v, endTime })} options={TIMES.filter((t) => t.value > v.startTime)} />
      </div>
      <NumberField id={id("needed")} label="Minimum crew" min={1} max={40} value={v.needed} onChange={(needed) => setV({ ...v, needed })} hint={adHoc ? "How many a new one asks for." : "Fewer confirmed than this is a gap."} />
      <NumberField id={id("cap")} label="Maximum crew" min={1} max={40} value={v.capacity} onChange={(capacity) => setV({ ...v, capacity })} />
      {!adHoc && (
        <fieldset className="grid gap-x-4 gap-y-5 rounded-lg border border-border bg-card p-4 @xl/admin:col-span-2 @xl/admin:grid-cols-2 @4xl/admin:col-span-4">
          <legend className="px-1 text-sm font-semibold text-ink">Last-minute cover</legend>
          <NumberField id={id("lm")} label="Notify last-minute volunteers" unit="hours" min={0} max={168} value={v.lastMinuteHours} onChange={(lastMinuteHours) => setV({ ...v, lastMinuteHours })} hint="0 turns it off." />
          <NumberField id={id("esc")} label="Alert the coordinator" unit="hours" min={0} max={168} value={v.escalateHours} onChange={(escalateHours) => setV({ ...v, escalateHours })} hint="0 turns it off." />
        </fieldset>
      )}
      {adHoc && <p className="text-xs text-muted-foreground @xl/admin:col-span-2 @4xl/admin:col-span-4">Harvests are planned one at a time. To message just the people on this kind of harvest, choose it as the audience in Announcements.</p>}
      <div className="flex gap-2 @xl/admin:col-span-2 @4xl/admin:col-span-4">
        <Button type="submit" size="sm" className="h-10 px-4" disabled={pending}>{pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Add shift type</Button>
        <Button type="button" variant="ghost" size="sm" className="h-10 px-4" onClick={() => setOpen(false)}><X className="size-4" /> Cancel</Button>
      </div>
    </form>
  );
}

export function RetireShiftTypeButton({ id, name, active }: { id: string; name: string; active: boolean }) {
  return active ? (
    <ActionButton variant="ghost" size="sm" className="h-9 text-muted-foreground" action={() => setShiftTypeActive(id, false)} confirm={{ title: `Retire ${name}?`, description: "It stops appearing when you plan or schedule shifts. Shifts already on the roster carry on.", confirmLabel: "Retire", cancelLabel: "Keep it" }}>
      <Archive className="size-4" aria-hidden /> Retire
    </ActionButton>
  ) : (
    <ActionButton variant="outline" size="sm" className="h-9" action={() => setShiftTypeActive(id, true)}>
      <ArchiveRestore className="size-4" aria-hidden /> Bring back
    </ActionButton>
  );
}
