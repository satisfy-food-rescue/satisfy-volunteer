"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarPlus, Check, ClipboardCheck, Loader2, MessageSquareText, Pencil, PhoneCall, Save, X } from "lucide-react";
import { bookInitialVisit, logContact, recordCoordinatorCompletion, saveVolunteerNotes, setVolunteerRoles, updateVolunteerProfile } from "@/app/admin/actions";
import type { ActionResult } from "@/lib/volunteer-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { OptionSelect, type Option } from "@/components/shared/option-select";
import { TIMES } from "@/components/admin/training-admin-controls";
import { ROLE_LABEL, VOLUNTEER_ROLES, type VolunteerRole } from "@/lib/domain";
import { cn } from "@/lib/utils";

/** Runs a server action, toasts the result and refreshes. Resolves true on success. */
function useAction() {
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (action: () => Promise<ActionResult>, onOk?: () => void) =>
    start(async () => {
      const r = await action();
      if (r.ok) {
        toast.success(r.message ?? "Saved.");
        onOk?.();
        router.refresh();
      } else toast.error(r.error);
    });
  return [pending, run] as const;
}

const Spinner = () => <Loader2 className="size-4 animate-spin" aria-hidden />;

export function NotesEditor({ volunteerId, initial }: { volunteerId: string; initial: string }) {
  const [notes, setNotes] = useState(initial);
  const [pending, run] = useAction();
  return (
    <div className="flex flex-col gap-2">
      <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className="text-base" placeholder="Private coordinator notes. Volunteers never see these." aria-label="Coordinator notes" />
      <Button size="sm" className="h-10 self-end" disabled={pending || notes === initial} onClick={() => run(() => saveVolunteerNotes(volunteerId, notes))}>
        {pending ? <Spinner /> : <Save className="size-4" />} Save notes
      </Button>
    </div>
  );
}

export function RolesEditor({ volunteerId, initial }: { volunteerId: string; initial: VolunteerRole[] }) {
  const [roles, setRoles] = useState<VolunteerRole[]>(initial);
  const [pending, run] = useAction();
  const changed = roles.join() !== initial.join();
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {VOLUNTEER_ROLES.map((r) => {
          const on = roles.includes(r);
          return (
            <label key={r} className={cn("flex h-10 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition-colors has-focus-visible:outline-3 has-focus-visible:outline-ring", on ? "border-teal bg-teal-tint text-teal-deep" : "border-border bg-card text-muted-foreground hover:text-ink")}>
              <input type="checkbox" className="sr-only" checked={on} onChange={() => setRoles(on ? roles.filter((x) => x !== r) : VOLUNTEER_ROLES.filter((x) => x === r || roles.includes(x)))} />
              {on && <Check className="size-4" aria-hidden />}
              {ROLE_LABEL[r]}
            </label>
          );
        })}
      </div>
      {changed && (
        <div className="flex flex-col gap-2 rounded-xl bg-status-info-bg p-3 text-sm text-status-info">
          <p>Saving emails the volunteer coordinator, since new roles can bring new training.</p>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" className="h-9" disabled={pending} onClick={() => setRoles(initial)}>Undo</Button>
            <Button size="sm" className="h-9" disabled={pending} onClick={() => run(() => setVolunteerRoles(volunteerId, roles))}>
              {pending ? <Spinner /> : <Save className="size-4" />} Save roles
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function RecordCompletionButton({ volunteerId, moduleId, moduleName, firstName, today }: { volunteerId: string; moduleId: string; moduleName: string; firstName: string; today: string }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today);
  const [pending, run] = useAction();
  return (
    <>
      <Button size="sm" variant="outline" className="h-9" onClick={() => { setDate(today); setOpen(true); }}>
        <ClipboardCheck className="size-4" /> Mark complete
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl text-ink">Mark {moduleName} complete</DialogTitle>
            <DialogDescription>Pick the day {firstName} completed it. Any refresher is due from that date, and shifts it unlocks open straight away.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`done-${moduleId}`}>Completed on</Label>
            <DatePicker id={`done-${moduleId}`} value={date} max={today} onChange={setDate} />
          </div>
          <DialogFooter>
            <Button variant="ghost" className="h-10" onClick={() => setOpen(false)}>Cancel</Button>
            <Button className="h-10" disabled={pending || !date} onClick={() => run(() => recordCoordinatorCompletion({ volunteerId, moduleId, completedISO: date }), () => setOpen(false))}>
              {pending ? <Spinner /> : <Check className="size-4" />} Mark complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export type ProfileValues = { phone: string; suburb: string; emergencyName: string; emergencyPhone: string; availabilityNote: string; lastMinuteOk: boolean; inHarvestPool: boolean };

export function ProfileEditor({ volunteerId, initial, children }: { volunteerId: string; initial: ProfileValues; children: React.ReactNode }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(initial);
  const [pending, run] = useAction();
  const set = (k: keyof ProfileValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });
  if (!editing) {
    return (
      <div className="flex flex-col gap-3">
        {children}
        <Button variant="outline" size="sm" className="h-10 self-start" onClick={() => { setV(initial); setEditing(true); }}>
          <Pencil className="size-4" /> Edit details
        </Button>
      </div>
    );
  }
  const field = (id: keyof ProfileValues, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`pe-${id}`}>{label}</Label>
      <Input id={`pe-${id}`} value={v[id] as string} onChange={set(id)} className="h-11 bg-card text-base" {...props} />
    </div>
  );
  const toggle = (id: "lastMinuteOk" | "inHarvestPool", label: string, hint: string) => (
    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4 rounded-lg border border-border bg-card p-3">
      <span>
        <span className="block text-sm font-semibold text-ink">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
      <Switch checked={v[id]} onCheckedChange={(c) => setV({ ...v, [id]: c })} aria-label={label} />
    </label>
  );
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => { e.preventDefault(); run(() => updateVolunteerProfile({ volunteerId, ...v }), () => setEditing(false)); }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {field("phone", "Mobile", { type: "tel" })}
        {field("suburb", "Suburb or town")}
        {field("emergencyName", "Emergency contact", { placeholder: "e.g. Sam, partner" })}
        {field("emergencyPhone", "Emergency phone", { type: "tel" })}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pe-availabilityNote">Availability</Label>
        <Textarea id="pe-availabilityNote" rows={3} value={v.availabilityNote} onChange={set("availabilityNote")} className="bg-card text-base" placeholder="e.g. Most weekday mornings, not Fridays" />
      </div>
      {toggle("lastMinuteOk", "Last-minute cover", "Gets a push notification when a shift they can do needs cover at short notice.")}
      {toggle("inHarvestPool", "Harvest pool", "Hears about seasonal harvest callouts.")}
      <div className="flex gap-2">
        <Button type="submit" size="sm" className="h-10 px-4" disabled={pending}>{pending ? <Spinner /> : <Check className="size-4" />} Save details</Button>
        <Button type="button" variant="ghost" size="sm" className="h-10 px-4" onClick={() => setEditing(false)}><X className="size-4" /> Cancel</Button>
      </div>
    </form>
  );
}

export function ContactLogForm({ volunteerId, firstName }: { volunteerId: string; firstName: string }) {
  const [kind, setKind] = useState<"CALL" | "NOTE">("CALL");
  const [summary, setSummary] = useState("");
  const [pending, run] = useAction();
  return (
    <form
      className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-3"
      onSubmit={(e) => { e.preventDefault(); run(() => logContact({ volunteerId, kind, summary }), () => setSummary("")); }}
    >
      <div className="flex gap-1.5" role="radiogroup" aria-label="Entry type">
        {([["CALL", "Log a call", PhoneCall], ["NOTE", "Add a note", MessageSquareText]] as const).map(([k, label, Icon]) => (
          <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={cn("flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition-colors", kind === k ? "border-teal bg-teal-tint text-teal-deep" : "border-border text-muted-foreground hover:text-ink")}>
            <Icon className="size-4" aria-hidden /> {label}
          </button>
        ))}
      </div>
      <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={2} className="text-base" aria-label={kind === "CALL" ? "Call summary" : "Note"} placeholder={kind === "CALL" ? `What did you and ${firstName} talk about?` : `Anything to remember about ${firstName}`} />
      <Button type="submit" size="sm" className="h-10 self-end" disabled={pending || summary.trim().length < 2}>
        {pending ? <Spinner /> : <Save className="size-4" />} {kind === "CALL" ? "Log call" : "Add note"}
      </Button>
    </form>
  );
}

function addMinutes(hhmm: string, mins: number) {
  const [h, m] = hhmm.split(":").map(Number);
  const t = Math.min(h * 60 + m + mins, 20 * 60);
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

export function BookInitialVisitButton({
  volunteer,
  openSlots,
  today,
  defaultDate,
  rebook,
}: {
  volunteer: { id: string; firstName: string };
  /** Upcoming initial-visit sessions with a free place. */
  openSlots: Option[];
  today: string;
  /** Suggested date for a new time: the next working day. */
  defaultDate: string;
  /** True when a visit is already booked: the button moves it. */
  rebook: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [slot, setSlot] = useState(openSlots[0]?.value ?? "");
  const [v, setV] = useState({ date: defaultDate, startTime: "10:00", endTime: "11:00", location: "Satisfy warehouse, Rangiora" });
  const [pending, run] = useAction();
  const submit = () =>
    run(
      () => (mode === "existing" ? bookInitialVisit({ mode, volunteerId: volunteer.id, sessionId: slot }) : bookInitialVisit({ mode, volunteerId: volunteer.id, ...v })),
      () => setOpen(false),
    );
  return (
    <>
      <Button size={rebook ? "sm" : "lg"} variant={rebook ? "outline" : "default"} className={rebook ? "h-10" : "h-11"} onClick={() => { setMode("new"); setSlot(openSlots[0]?.value ?? ""); setOpen(true); }}>
        <CalendarPlus className="size-4" /> {rebook ? "Change initial visit" : "Book initial visit"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        {/* Pinned to the top so switching modes changes height without moving the buttons under the pointer. */}
        <DialogContent className="top-[12vh] translate-y-0 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl text-ink">{rebook ? "Change" : "Book"} {volunteer.firstName}&apos;s initial visit</DialogTitle>
            <DialogDescription>Agree a time on the call and book it here. {volunteer.firstName} gets an email confirming the details.</DialogDescription>
          </DialogHeader>
          {openSlots.length > 0 && (
            <div className="flex gap-1.5" role="radiogroup" aria-label="Visit time">
              {([["new", "A new time"], ["existing", `An open slot (${openSlots.length})`]] as const).map(([k, label]) => (
                <button key={k} type="button" role="radio" aria-checked={mode === k} onClick={() => setMode(k)} className={cn("h-10 rounded-full border px-4 text-sm font-semibold transition-colors", mode === k ? "border-teal bg-teal-tint text-teal-deep" : "border-border text-muted-foreground hover:text-ink")}>
                  {label}
                </button>
              ))}
            </div>
          )}
          {mode === "existing" ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="iv-slot">Slot</Label>
              <OptionSelect id="iv-slot" value={slot} onValueChange={setSlot} options={openSlots} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 flex flex-col gap-1.5"><Label htmlFor="iv-date">Date</Label><DatePicker id="iv-date" min={today} value={v.date} onChange={(date) => setV({ ...v, date })} /></div>
              <div className="flex flex-col gap-1.5"><Label htmlFor="iv-start">Start</Label><OptionSelect id="iv-start" value={v.startTime} onValueChange={(startTime) => setV({ ...v, startTime, endTime: v.endTime > startTime ? v.endTime : addMinutes(startTime, 60) })} options={TIMES.filter((t) => t.value < "20:00")} /></div>
              <div className="flex flex-col gap-1.5"><Label htmlFor="iv-end">End</Label><OptionSelect id="iv-end" value={v.endTime} onValueChange={(endTime) => setV({ ...v, endTime })} options={TIMES.filter((t) => t.value > v.startTime)} /></div>
              <div className="col-span-2 flex flex-col gap-1.5"><Label htmlFor="iv-loc">Where</Label><Input id="iv-loc" value={v.location} onChange={(e) => setV({ ...v, location: e.target.value })} className="h-11 text-base" /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" className="h-10" onClick={() => setOpen(false)}>Cancel</Button>
            <Button className="h-10" disabled={pending || (mode === "existing" && !slot)} onClick={submit}>
              {pending ? <Spinner /> : <Check className="size-4" />} {rebook ? "Move visit" : "Book visit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
