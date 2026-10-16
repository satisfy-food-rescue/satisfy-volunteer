"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarPlus, Check, Link2, Loader2, Pencil, Play, Plus, Trash2, X } from "lucide-react";
import { createSession, markSessionAttendance, runRemindersNow, saveModule, type ModuleInput } from "@/app/admin/actions";
import { ActionButton } from "@/components/app/action-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { OptionSelect, type Option } from "@/components/shared/option-select";
import { formatTime } from "@/lib/dates";
import { ROLE_SHORT, VOLUNTEER_ROLES } from "@/lib/domain";
import { cn } from "@/lib/utils";

export type ModuleForm = Omit<ModuleInput, "id"> & { id: string | null };

const DELIVERY: Option<ModuleForm["delivery"]>[] = [
  { value: "IN_PERSON", label: "In-person session" },
  { value: "ONLINE_CONFIRM", label: "Online module" },
];

const BLANK_MODULE: ModuleForm = { id: null, name: "", description: "", validityMonths: 12, requiredRoles: [], mandatoryBeforeFirstShift: false, delivery: "ONLINE_CONFIRM", content: "", links: [] };

// Session times in 15-minute steps across the working day.
export const TIMES: Option[] = Array.from({ length: (20 - 6) * 4 + 1 }, (_, i) => {
  const mins = 6 * 60 + i * 15;
  const value = `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
  return { value, label: formatTime(value) };
});

/** Edits a module, or adds one when `module` is omitted. */
export function ModuleEditor({ module }: { module?: ModuleForm }) {
  const initial = module ?? BLANK_MODULE;
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(initial);
  const [pending, run] = useTransition();
  const router = useRouter();
  const key = v.id ?? "new";
  if (!open) {
    return module ? (
      <Button variant="outline" size="sm" className="h-9" onClick={() => setOpen(true)}><Pencil className="size-4" /> Edit module</Button>
    ) : (
      <Button size="lg" className="h-11 self-start" onClick={() => setOpen(true)}><Plus className="size-4" /> Add a module</Button>
    );
  }
  const online = v.delivery === "ONLINE_CONFIRM";
  const setLink = (i: number, patch: Partial<ModuleForm["links"][number]>) => setV({ ...v, links: v.links.map((l, j) => (j === i ? { ...l, ...patch } : l)) });
  return (
    <form
      className={cn("grid gap-x-4 gap-y-5 rounded-xl border border-teal/25 bg-teal-tint-soft p-4 sm:grid-cols-2", module && "mt-3")}
      onSubmit={(e) => {
        e.preventDefault();
        run(async () => {
          const r = await saveModule(v);
          if (r.ok) {
            toast.success(r.message);
            setOpen(false);
            if (!module) setV(BLANK_MODULE);
            router.refresh();
          } else toast.error(r.error);
        });
      }}
    >
      {!module && <h2 className="text-xl text-ink sm:col-span-2">New module</h2>}
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor={`m-name-${key}`}>Module name</Label>
        <Input id={`m-name-${key}`} required value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} className="h-11 bg-card text-base" placeholder="For example, Use of Ladders" />
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor={`m-desc-${key}`}>Summary</Label>
        <Input id={`m-desc-${key}`} required value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} className="h-11 bg-card text-base" placeholder="One line shown on the training list" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`m-val-${key}`}>Valid for</Label>
        <div className="relative">
          <Input id={`m-val-${key}`} type="number" min={1} max={60} placeholder="Never expires" aria-describedby={`m-val-hint-${key}`} value={v.validityMonths ?? ""} onChange={(e) => setV({ ...v, validityMonths: e.target.value ? Number(e.target.value) : null })} className="h-11 bg-card pr-20 text-base" />
          {v.validityMonths != null && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">months</span>}
        </div>
        <p id={`m-val-hint-${key}`} className="text-xs text-muted-foreground">Leave blank if it never expires.</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`m-del-${key}`}>Delivery</Label>
        <OptionSelect id={`m-del-${key}`} value={v.delivery} onValueChange={(d) => setV({ ...v, delivery: d })} options={DELIVERY} />
      </div>
      <fieldset className="flex flex-col gap-2 sm:col-span-2">
        <legend className="mb-2 text-sm font-medium">Required for</legend>
        <div className="flex flex-wrap gap-2">
          {VOLUNTEER_ROLES.map((r) => {
            const on = v.requiredRoles.includes(r);
            return (
              <label key={r} className={cn("flex h-10 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 font-display text-sm font-semibold transition-colors has-focus-visible:outline-3 has-focus-visible:outline-ring", on ? "border-teal bg-card text-teal-deep" : "border-border bg-card/60 text-muted-foreground hover:text-ink")}>
                <input type="checkbox" className="sr-only" checked={on} onChange={() => setV({ ...v, requiredRoles: on ? v.requiredRoles.filter((x) => x !== r) : [...v.requiredRoles, r] })} />
                {on && <Check className="size-4 text-teal" aria-hidden />}
                {ROLE_SHORT[r]}
              </label>
            );
          })}
        </div>
      </fieldset>
      {online && (
        <>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor={`m-content-${key}`}>What volunteers read</Label>
            <Textarea id={`m-content-${key}`} rows={8} value={v.content} onChange={(e) => setV({ ...v, content: e.target.value })} aria-describedby={`m-content-hint-${key}`} className="bg-card text-base leading-relaxed" placeholder={"Bend your knees, not your back.\n\nTest the weight first."} />
            <p id={`m-content-hint-${key}`} className="text-xs text-muted-foreground">Leave a blank line between points. Each point is shown as a numbered card, and volunteers scroll to the last one before they can confirm.</p>
          </div>
          <fieldset className="flex flex-col gap-2 sm:col-span-2" aria-describedby={`m-links-hint-${key}`}>
            <legend className="mb-1 text-sm font-medium">Videos and links</legend>
            <p id={`m-links-hint-${key}`} className="-mt-1 mb-1 text-xs text-muted-foreground">Volunteers must open each one before they can confirm. YouTube videos, MPI courses or any https page.</p>
            {v.links.map((l, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto] gap-2 rounded-lg border border-border bg-card p-2.5 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto]">
                <Input aria-label={`Link ${i + 1} label`} value={l.label} onChange={(e) => setLink(i, { label: e.target.value })} className="h-10 text-base" placeholder="Video title" />
                <Input aria-label={`Link ${i + 1} address`} type="url" inputMode="url" value={l.url} onChange={(e) => setLink(i, { url: e.target.value })} className="col-span-1 row-start-2 h-10 text-base sm:row-start-auto" placeholder="https://www.youtube.com/watch?v=" />
                <Button type="button" variant="ghost" size="icon" className="row-span-2 size-10 self-center text-muted-foreground hover:text-destructive sm:row-span-1" aria-label={`Remove link ${i + 1}`} onClick={() => setV({ ...v, links: v.links.filter((_, j) => j !== i) })}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            {v.links.length < 10 && (
              <Button type="button" variant="outline" size="sm" className="h-10 self-start bg-card" onClick={() => setV({ ...v, links: [...v.links, { label: "", url: "" }] })}>
                <Link2 className="size-4" /> Add a video or link
              </Button>
            )}
          </fieldset>
        </>
      )}
      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card p-3 sm:col-span-2">
        <Checkbox className="mt-0.5 size-5" checked={v.mandatoryBeforeFirstShift} onCheckedChange={(c) => setV({ ...v, mandatoryBeforeFirstShift: c })} />
        <span className="flex flex-col">
          <span className="text-sm font-semibold text-ink">Mandatory before first shift</span>
          <span className="text-xs text-muted-foreground">New volunteers cannot book until this module is complete.</span>
        </span>
      </label>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" size="sm" className="h-10 px-4" disabled={pending}>{pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} {module ? "Save module" : "Add module"}</Button>
        <Button type="button" variant="ghost" size="sm" className="h-10 px-4" onClick={() => { setV(initial); setOpen(false); }}><X className="size-4" /> Cancel</Button>
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
    <form className="grid grid-cols-1 gap-4 rounded-2xl border border-teal/30 bg-card p-4 sm:grid-cols-2 @4xl/admin:grid-cols-3" onSubmit={(e) => { e.preventDefault(); run(async () => { const r = await createSession(v); if (r.ok) { toast.success(r.message); setOpen(false); router.refresh(); } else toast.error(r.error); }); }}>
      <div className="flex flex-col gap-1.5 @4xl/admin:col-span-3">
        <Label htmlFor="s-mod">Module</Label>
        <OptionSelect id="s-mod" value={v.moduleId} onValueChange={(moduleId) => setV({ ...v, moduleId })} options={modules.map((m) => ({ value: m.id, label: m.name }))} />
      </div>
      <div className="flex flex-col gap-1.5"><Label htmlFor="s-date">Date</Label><DatePicker id="s-date" min={today} value={v.date} onChange={(date) => setV({ ...v, date })} /></div>
      <div className="flex flex-col gap-1.5"><Label htmlFor="s-start">Start</Label><OptionSelect id="s-start" value={v.startTime} onValueChange={(startTime) => setV({ ...v, startTime, endTime: v.endTime > startTime ? v.endTime : TIMES[Math.min(TIMES.length - 1, TIMES.findIndex((t) => t.value === startTime) + 3)].value })} options={TIMES} /></div>
      <div className="flex flex-col gap-1.5"><Label htmlFor="s-end">End</Label><OptionSelect id="s-end" value={v.endTime} onValueChange={(endTime) => setV({ ...v, endTime })} options={TIMES.filter((t) => t.value > v.startTime)} /></div>
      <div className="flex flex-col gap-1.5 sm:col-span-2"><Label htmlFor="s-loc">Location</Label><Input id="s-loc" value={v.location} onChange={(e) => setV({ ...v, location: e.target.value })} className="h-11 text-base" /></div>
      <div className="flex flex-col gap-1.5"><Label htmlFor="s-cap">Capacity</Label><Input id="s-cap" type="number" min={1} max={60} value={v.capacity} onChange={(e) => setV({ ...v, capacity: Number(e.target.value) })} className="h-11 text-base" /></div>
      <div className="flex flex-col gap-1.5 @4xl/admin:col-span-3"><Label htmlFor="s-notes">Notes for volunteers</Label><Textarea id="s-notes" rows={2} value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} className="text-base" /></div>
      <div className="flex gap-2 @4xl/admin:col-span-3">
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
