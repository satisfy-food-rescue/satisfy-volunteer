"use client";

import { useState } from "react";
import { Check, Loader2, Save, Trash2, UserCheck } from "lucide-react";
import { recordMojCheck, removeMojCheck, saveMojRoles } from "@/app/admin/induction-actions";
import { useAction } from "@/components/admin/volunteer-admin-controls";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ROLE_SHORT, VOLUNTEER_ROLES, type VolunteerRole } from "@/lib/domain";
import { cn } from "@/lib/utils";

const Spinner = () => <Loader2 className="size-4 animate-spin" aria-hidden />;

/** Records a Ministry of Justice check the coordinator has sighted, with the
 *  date printed on it. */
export function RecordMojCheckButton({ volunteer, today, renewing, size = "sm" }: { volunteer: { id: string; firstName: string }; today: string; renewing: boolean; size?: "sm" | "default" }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [pending, run] = useAction();
  const id = `moj-${volunteer.id}`;
  return (
    <>
      <Button size={size} variant="outline" className={size === "sm" ? "h-9" : "h-10"} onClick={() => { setDate(""); setNote(""); setOpen(true); }}>
        <UserCheck className="size-4" aria-hidden /> {renewing ? "Record new check" : "Record check"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl text-ink">Record {volunteer.firstName}&apos;s Ministry of Justice check</DialogTitle>
            <DialogDescription>Once you have seen the check, pick the date printed on it. It renews three years from that date, and {volunteer.firstName} is emailed to say it is done.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${id}-date`}>Date on the check</Label>
              <DatePicker id={`${id}-date`} value={date} max={today} onChange={setDate} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${id}-note`}>Note <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Textarea id={`${id}-note`} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="For example, sighted the emailed copy" className="text-base" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={pending || !date} onClick={() => run(() => recordMojCheck({ volunteerId: volunteer.id, checkedISO: date, note }), () => setOpen(false))}>
              {pending ? <Spinner /> : <Check className="size-4" aria-hidden />} Record check
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function RemoveMojCheckButton({ checkId, label }: { checkId: string; label: string }) {
  const [pending, run] = useAction();
  const [asking, setAsking] = useState(false);
  return (
    <>
      <Button variant="ghost" size="icon" className="size-9 text-muted-foreground hover:text-status-bad" disabled={pending} onClick={() => setAsking(true)} aria-label={`Remove the check dated ${label}`}>
        {pending ? <Spinner /> : <Trash2 className="size-4" aria-hidden />}
      </Button>
      <Dialog open={asking} onOpenChange={setAsking}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl text-ink">Remove the check dated {label}?</DialogTitle>
            <DialogDescription>For a check recorded by mistake. If it was their only one, they will need a check recorded again before training or booking.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="h-11" onClick={() => setAsking(false)}>Keep it</Button>
            <Button variant="destructive" className="h-11" disabled={pending} onClick={() => run(() => removeMojCheck(checkId), () => setAsking(false))}>
              {pending ? <Spinner /> : <Trash2 className="size-4" aria-hidden />} Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Which roles need a Ministry of Justice check. */
export function MojRolesForm({ initial }: { initial: VolunteerRole[] }) {
  const [roles, setRoles] = useState<VolunteerRole[]>(initial);
  const [pending, run] = useAction();
  const changed = roles.join() !== initial.join();
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-2 text-sm font-semibold text-ink">Roles that need a check</legend>
      <div className="flex flex-wrap gap-2">
        {VOLUNTEER_ROLES.map((r) => {
          const on = roles.includes(r);
          return (
            <label key={r} className={cn("flex h-10 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 font-display text-sm font-semibold transition-colors has-focus-visible:outline-3 has-focus-visible:outline-ring", on ? "border-teal bg-teal-tint text-teal-deep" : "border-border bg-card text-muted-foreground hover:text-ink")}>
              <input type="checkbox" className="sr-only" checked={on} onChange={() => setRoles(on ? roles.filter((x) => x !== r) : VOLUNTEER_ROLES.filter((x) => x === r || roles.includes(x)))} />
              {on && <Check className="size-4" aria-hidden />}
              {ROLE_SHORT[r]}
            </label>
          );
        })}
      </div>
      {changed && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-status-info-bg p-3 text-sm text-status-info">
          <p className="min-w-0 flex-1">Volunteers with {roles.length === 0 ? "no role" : "these roles"} will need a current check before their next training or booking. Record the checks you already hold first.</p>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="h-9" disabled={pending} onClick={() => setRoles(initial)}>Undo</Button>
            <Button size="sm" className="h-9" disabled={pending} onClick={() => run(() => saveMojRoles({ roles }))}>
              {pending ? <Spinner /> : <Save className="size-4" aria-hidden />} Save
            </Button>
          </div>
        </div>
      )}
    </fieldset>
  );
}
