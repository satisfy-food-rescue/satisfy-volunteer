"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarPlus, Check, Loader2, Pencil, Play, X } from "lucide-react";
import { createSession, markSessionAttendance, runRemindersNow, updateModule } from "@/app/admin/actions";
import { ActionButton } from "@/components/app/action-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { OptionSelect, type Option } from "@/components/shared/option-select";
import { formatTime } from "@/lib/dates";
import { ROLE_SHORT, VOLUNTEER_ROLES, type VolunteerRole } from "@/lib/domain";
import { cn } from "@/lib/utils";

export type ModuleForm = { id: string; name: string; validityMonths: number | null; requiredRoles: VolunteerRole[]; mandatoryBeforeFirstShift: boolean; delivery: "IN_PERSON" | "ONLINE_CONFIRM" };

const DELIVERY: Option<ModuleForm["delivery"]>[] = [
  { value: "IN_PERSON", label: "In-person session" },
  { value: "ONLINE_CONFIRM", label: "Online: read and confirm" },
];

// Session times in 15-minute steps across the working day.
export const TIMES: Option[] = Array.from({ length: (20 - 6) * 4 + 1 }, (_, i) => {
  const mins = 6 * 60 + i * 15;
  const value = `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
  return { value, label: formatTime(value) };
});

export function ModuleEditor({ module }: { module: ModuleForm }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(module);
  const [pending, run] = useTransition();
  const router = useRouter();
  if (!open) {
    return <Button variant="outline" size="sm" className="h-9" onClick={() => setOpen(true)}><Pencil className="size-4" /> Configure</Button>;
  }
  return (
    <form
      className="mt-3 grid gap-x-4 gap-y-5 rounded-xl border border-green/40 bg-green-tint-soft p-4 sm:grid-cols-2"
      onSubmit={(e) => { e.preventDefault(); run(async () => { const r = await updateModule(v); if (r.ok) { toast.success(r.message); setOpen(false); router.refresh(); } else toast.error(r.error); }); }}
    >
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor={`m-name-${v.id}`}>Module name</Label>
        <Input id={`m-name-${v.id}`} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} className="h-11 bg-card text-base" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`m-val-${v.id}`}>Valid for</Label>
        <div className="relative">
          <Input id={`m-val-${v.id}`} type="number" min={1} max={60} placeholder="Never expires" aria-describedby={`m-val-hint-${v.id}`} value={v.validityMonths ?? ""} onChange={(e) => setV({ ...v, validityMonths: e.target.value ? Number(e.target.value) : null })} className="h-11 bg-card pr-20 text-base" />
          {v.validityMonths != null && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">months</span>}
        </div>
        <p id={`m-val-hint-${v.id}`} className="text-xs text-muted-foreground">Leave blank if it never expires.</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`m-del-${v.id}`}>Delivery</Label>
        <OptionSelect id={`m-del-${v.id}`} value={v.delivery} onValueChange={(d) => setV({ ...v, delivery: d })} options={DELIVERY} />
      </div>
      <fieldset className="flex flex-col gap-2 sm:col-span-2">
        <legend className="mb-2 text-sm font-medium">Required for</legend>
        <div className="flex flex-wrap gap-2">
          {VOLUNTEER_ROLES.map((r) => {
            const on = v.requiredRoles.includes(r);
            return (
              <label key={r} className={cn("flex h-10 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 font-display text-sm font-semibold transition-colors has-focus-visible:outline-3 has-focus-visible:outline-green", on ? "border-green bg-card text-green-deep" : "border-border bg-card/60 text-muted-foreground hover:text-ink")}>
                <input type="checkbox" className="sr-only" checked={on} onChange={() => setV({ ...v, requiredRoles: on ? v.requiredRoles.filter((x) => x !== r) : [...v.requiredRoles, r] })} />
                {on && <Check className="size-4 text-green-text" aria-hidden />}
                {ROLE_SHORT[r]}
              </label>
            );
          })}
        </div>
      </fieldset>
      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card p-3 sm:col-span-2">
        <Checkbox className="mt-0.5 size-5" checked={v.mandatoryBeforeFirstShift} onCheckedChange={(c) => setV({ ...v, mandatoryBeforeFirstShift: c })} />
        <span className="flex flex-col">
          <span className="text-sm font-semibold text-ink">Mandatory before first shift</span>
          <span className="text-xs text-muted-foreground">New volunteers cannot book until this module is complete.</span>
        </span>
      </label>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" size="sm" className="h-10 px-4" disabled={pending}>{pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Save module</Button>
        <Button type="button" variant="ghost" size="sm" className="h-10 px-4" onClick={() => { setV(module); setOpen(false); }}><X className="size-4" /> Cancel</Button>
      </div>
    </form>
  );
}

export function NewSessionForm({ modules, today }: { modules: { id: string; name: string }[]; today: string }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ moduleId: modules[0]?.id ?? "", date: today, startTime: "12:30", endTime: "13:15", location: "Satisfy warehouse, Rangiora", capacity: 10, notes: "" });
  const [pending, run] = useTransition();
  const router = useRouter();
  if (!open) return <Button size="lg" className="h-11" onClick={() => setOpen(true)}><CalendarPlus className="size-4" /> Schedule a session</Button>;
  return (
    <form className="grid grid-cols-1 gap-4 rounded-2xl border border-green/40 bg-card p-4 sm:grid-cols-2 lg:grid-cols-3" onSubmit={(e) => { e.preventDefault(); run(async () => { const r = await createSession(v); if (r.ok) { toast.success(r.message); setOpen(false); router.refresh(); } else toast.error(r.error); }); }}>
      <div className="flex flex-col gap-1.5 lg:col-span-3">
        <Label htmlFor="s-mod">Module</Label>
        <OptionSelect id="s-mod" value={v.moduleId} onValueChange={(moduleId) => setV({ ...v, moduleId })} options={modules.map((m) => ({ value: m.id, label: m.name }))} />
      </div>
      <div className="flex flex-col gap-1.5"><Label htmlFor="s-date">Date</Label><DatePicker id="s-date" min={today} value={v.date} onChange={(date) => setV({ ...v, date })} /></div>
      <div className="flex flex-col gap-1.5"><Label htmlFor="s-start">Start</Label><OptionSelect id="s-start" value={v.startTime} onValueChange={(startTime) => setV({ ...v, startTime, endTime: v.endTime > startTime ? v.endTime : TIMES[Math.min(TIMES.length - 1, TIMES.findIndex((t) => t.value === startTime) + 3)].value })} options={TIMES} /></div>
      <div className="flex flex-col gap-1.5"><Label htmlFor="s-end">End</Label><OptionSelect id="s-end" value={v.endTime} onValueChange={(endTime) => setV({ ...v, endTime })} options={TIMES.filter((t) => t.value > v.startTime)} /></div>
      <div className="flex flex-col gap-1.5 sm:col-span-2"><Label htmlFor="s-loc">Location</Label><Input id="s-loc" value={v.location} onChange={(e) => setV({ ...v, location: e.target.value })} className="h-11 text-base" /></div>
      <div className="flex flex-col gap-1.5"><Label htmlFor="s-cap">Capacity</Label><Input id="s-cap" type="number" min={1} max={60} value={v.capacity} onChange={(e) => setV({ ...v, capacity: Number(e.target.value) })} className="h-11 text-base" /></div>
      <div className="flex flex-col gap-1.5 lg:col-span-3"><Label htmlFor="s-notes">Notes for volunteers</Label><Textarea id="s-notes" rows={2} value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} className="text-base" /></div>
      <div className="flex gap-2 lg:col-span-3">
        <Button type="submit" size="sm" className="h-10" disabled={pending}>{pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Schedule</Button>
        <Button type="button" variant="ghost" size="sm" className="h-10" onClick={() => setOpen(false)}><X className="size-4" /> Cancel</Button>
      </div>
    </form>
  );
}

export function AttendanceToggle({ rsvpId, attended }: { rsvpId: string; attended: boolean }) {
  return (
    <ActionButton size="sm" variant={attended ? "default" : "outline"} className="h-9" action={() => markSessionAttendance(rsvpId, !attended)}>
      <Check className="size-4" /> {attended ? "Attended" : "Mark attended"}
    </ActionButton>
  );
}

export function RunRemindersButton() {
  return (
    <ActionButton size="lg" className="h-11" action={() => runRemindersNow()}>
      <Play className="size-4" /> Run reminder check now
    </ActionButton>
  );
}
