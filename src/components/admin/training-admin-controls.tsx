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
import { ROLE_SHORT, VOLUNTEER_ROLES, type VolunteerRole } from "@/lib/domain";
import { cn } from "@/lib/utils";

export type ModuleForm = { id: string; name: string; validityMonths: number | null; requiredRoles: VolunteerRole[]; mandatoryBeforeFirstShift: boolean; delivery: "IN_PERSON" | "ONLINE_CONFIRM" };

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
      className="mt-3 grid gap-4 rounded-xl border border-green/40 bg-green-tint-soft p-4 sm:grid-cols-2"
      onSubmit={(e) => { e.preventDefault(); run(async () => { const r = await updateModule(v); if (r.ok) { toast.success(r.message); setOpen(false); router.refresh(); } else toast.error(r.error); }); }}
    >
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor={`m-name-${v.id}`}>Module name</Label>
        <Input id={`m-name-${v.id}`} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} className="h-11 bg-white text-base" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`m-val-${v.id}`}>Validity (months, blank = never expires)</Label>
        <Input id={`m-val-${v.id}`} type="number" min={1} max={60} value={v.validityMonths ?? ""} onChange={(e) => setV({ ...v, validityMonths: e.target.value ? Number(e.target.value) : null })} className="h-11 bg-white text-base" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`m-del-${v.id}`}>Delivery</Label>
        <select id={`m-del-${v.id}`} value={v.delivery} onChange={(e) => setV({ ...v, delivery: e.target.value as ModuleForm["delivery"] })} className="h-11 rounded-lg border border-input bg-white px-3 text-base text-ink">
          <option value="IN_PERSON">In-person session</option>
          <option value="ONLINE_CONFIRM">Online: read and confirm</option>
        </select>
      </div>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-sm font-medium">Required for</legend>
        <div className="flex flex-wrap gap-1.5">
          {VOLUNTEER_ROLES.map((r) => {
            const on = v.requiredRoles.includes(r);
            return (
              <label key={r} className={cn("flex h-10 cursor-pointer items-center rounded-full border px-3 text-sm font-semibold", on ? "border-green bg-white text-green-deep" : "border-border bg-white/60 text-muted-foreground")}>
                <input type="checkbox" className="sr-only" checked={on} onChange={() => setV({ ...v, requiredRoles: on ? v.requiredRoles.filter((x) => x !== r) : [...v.requiredRoles, r] })} />
                {ROLE_SHORT[r]}
              </label>
            );
          })}
        </div>
      </fieldset>
      <label className="flex cursor-pointer items-center gap-3 self-end pb-1">
        <input type="checkbox" className="size-4 accent-[var(--brand-green)]" checked={v.mandatoryBeforeFirstShift} onChange={(e) => setV({ ...v, mandatoryBeforeFirstShift: e.target.checked })} />
        <span className="text-sm text-ink">Mandatory before first shift</span>
      </label>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" size="sm" className="h-10" disabled={pending}>{pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Save module</Button>
        <Button type="button" variant="ghost" size="sm" className="h-10" onClick={() => { setV(module); setOpen(false); }}><X className="size-4" /> Cancel</Button>
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
        <select id="s-mod" value={v.moduleId} onChange={(e) => setV({ ...v, moduleId: e.target.value })} className="h-11 rounded-lg border border-input bg-card px-3 text-base text-ink">{modules.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
      </div>
      <div className="flex flex-col gap-1.5"><Label htmlFor="s-date">Date</Label><Input id="s-date" type="date" min={today} value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} className="h-11 text-base" /></div>
      <div className="flex flex-col gap-1.5"><Label htmlFor="s-start">Start</Label><Input id="s-start" type="time" value={v.startTime} onChange={(e) => setV({ ...v, startTime: e.target.value })} className="h-11 text-base" /></div>
      <div className="flex flex-col gap-1.5"><Label htmlFor="s-end">End</Label><Input id="s-end" type="time" value={v.endTime} onChange={(e) => setV({ ...v, endTime: e.target.value })} className="h-11 text-base" /></div>
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
