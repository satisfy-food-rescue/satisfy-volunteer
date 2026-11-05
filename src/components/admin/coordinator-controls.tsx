"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Send, ShieldOff, UserPlus } from "lucide-react";
import { addAdmin, removeAdmin, sendVolunteerInvite, setAdminVolunteering } from "@/app/admin/actions";
import type { GrantAdminResult, NewAdminInput, ReleasePreview } from "@/lib/admin-access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FieldError } from "@/components/admin/field-error";
import { useAction } from "@/components/admin/volunteer-admin-controls";

const Spinner = () => <Loader2 className="size-4 animate-spin" aria-hidden />;

type Field = NonNullable<Extract<GrantAdminResult, { ok: false }>["field"]>;
const FIELD_INPUT: Record<Field, string> = { firstName: "nc-first", lastName: "nc-last", email: "nc-email" };
const EMPTY = { firstName: "", lastName: "", email: "" };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Adds a coordinator by name and email. Someone already on the system
 *  becomes a coordinator and keeps volunteering. */
export function AddCoordinatorButton() {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(EMPTY);
  const [fieldError, setFieldError] = useState<{ field: Field; message: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const set = (k: Field) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setV({ ...v, [k]: e.target.value });
    if (fieldError?.field === k) setFieldError(null);
  };
  const errorProps = (field: Field) => (fieldError?.field === field ? { "aria-invalid": true, "aria-describedby": `${FIELD_INPUT[field]}-error` } : {});
  const errorFor = (field: Field) => fieldError?.field === field && <FieldError id={`${FIELD_INPUT[field]}-error`}>{fieldError.message}</FieldError>;

  const submit = (input: NewAdminInput) =>
    start(async () => {
      const r = await addAdmin(input);
      if (r.ok) {
        toast.success(r.message);
        setOpen(false);
        setV(EMPTY);
        router.refresh();
        return;
      }
      if (!r.field) return void toast.error(r.error);
      setFieldError({ field: r.field, message: r.error });
      document.getElementById(FIELD_INPUT[r.field])?.focus();
    });

  return (
    <>
      <Button size="lg" className="px-4" onClick={() => { setFieldError(null); setOpen(true); }}>
        <UserPlus className="size-4" aria-hidden /> Add coordinator
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-[8vh] translate-y-0 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl text-ink">Add a coordinator</DialogTitle>
            <DialogDescription>They can use all of this admin. Someone new is emailed an invite to set up their account. If the email belongs to a volunteer, they become a coordinator and keep volunteering.</DialogDescription>
          </DialogHeader>
          <form id="add-coordinator" className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); submit(v); }}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="nc-first" className="text-base">First name</Label>
                <Input id="nc-first" required value={v.firstName} onChange={set("firstName")} className="h-11 text-base" {...errorProps("firstName")} />
                {errorFor("firstName")}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="nc-last" className="text-base">Last name</Label>
                <Input id="nc-last" value={v.lastName} onChange={set("lastName")} className="h-11 text-base" {...errorProps("lastName")} />
                {errorFor("lastName")}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nc-email" className="text-base">Email</Label>
              <Input id="nc-email" type="email" required value={v.email} onChange={set("email")} className="h-11 text-base" {...errorProps("email")} />
              {errorFor("email")}
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" className="h-11" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" form="add-coordinator" className="h-11" disabled={pending}>
              {pending ? <Spinner /> : <UserPlus className="size-4" aria-hidden />} Add coordinator
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Whether a coordinator is also in the volunteer pool. Taking them out
 *  releases their slots and shifts, so that asks first. */
export function VolunteeringSwitch({ coordinator, on, isSelf }: { coordinator: { id: string; firstName: string }; on: boolean; isSelf: boolean }) {
  const [confirm, setConfirm] = useState<ReleasePreview | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const send = (next: boolean, releaseConfirmed: boolean) =>
    start(async () => {
      const r = await setAdminVolunteering(coordinator.id, next, releaseConfirmed);
      if (r.ok) {
        toast.success(r.message);
        setConfirm(null);
        router.refresh();
      } else if (r.confirm) setConfirm(r.confirm);
      else toast.error(r.error);
    });
  const released = confirm && [
    confirm.regularSlots > 0 && plural(confirm.regularSlots, "regular slot", "regular slots"),
    confirm.upcomingShifts > 0 && plural(confirm.upcomingShifts, "upcoming shift", "upcoming shifts"),
  ].filter(Boolean).join(" and ");
  const id = `volunteers-${coordinator.id}`;
  return (
    <div className="flex items-center gap-2.5">
      <Switch id={id} checked={on} disabled={pending} onCheckedChange={(next) => send(next, false)} />
      <Label htmlFor={id} className="cursor-pointer text-sm font-semibold text-ink">
        Also volunteers{pending && <Spinner />}
      </Label>
      <Dialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent className="sm:max-w-md">
          {confirm && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl text-ink">Take {isSelf ? "yourself" : confirm.firstName} out of the volunteer lists?</DialogTitle>
                <DialogDescription>
                  {isSelf ? "You have" : `${confirm.name} has`} {released}. Coming out of the volunteer lists takes {isSelf ? "you" : confirm.firstName} off {confirm.regularSlots + confirm.upcomingShifts === 1 ? "it" : "them"}
                  {confirm.upcomingShifts > 0 ? ", and any shift left short will need cover" : ""}. Training and history are kept.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" className="h-11" disabled={pending} onClick={() => setConfirm(null)}>
                  <ArrowLeft className="size-4" aria-hidden /> Keep volunteering
                </Button>
                <Button variant="destructive" className="h-11" disabled={pending} onClick={() => send(false, true)}>
                  {pending ? <Spinner /> : null} Take off the roster
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Resend an invite to someone who has not signed in yet, and remove access
 *  (never your own). */
export function CoordinatorActions({ coordinator, isSelf, canInvite }: { coordinator: { id: string; firstName: string; name: string }; isSelf: boolean; canInvite: boolean }) {
  const [pending, run] = useAction();
  const [confirming, setConfirming] = useState(false);
  const { id, firstName, name } = coordinator;
  if (isSelf && !canInvite) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {canInvite && (
        <Button variant="outline" className="h-11 px-3" disabled={pending} onClick={() => run(() => sendVolunteerInvite(id))}>
          {pending ? <Spinner /> : <Send className="size-4" aria-hidden />} Send invite
        </Button>
      )}
      {!isSelf && (
        <Button variant="ghost" className="h-11 px-3 text-muted-foreground hover:text-status-bad" disabled={pending} onClick={() => setConfirming(true)}>
          <ShieldOff className="size-4" aria-hidden /> Remove access<span className="sr-only"> for {name}</span>
        </Button>
      )}
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl text-ink">Remove {firstName}&apos;s coordinator access?</DialogTitle>
            <DialogDescription>
              {firstName} will no longer be able to use this admin, and is emailed about the change. The account stays open as a volunteer, listed under Volunteers, where you can deactivate it if {firstName} should not sign in at all.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="h-11" onClick={() => setConfirming(false)}>Keep access</Button>
            <Button variant="destructive" className="h-11" disabled={pending} onClick={() => run(() => removeAdmin(id), () => setConfirming(false))}>
              {pending ? <Spinner /> : <ShieldOff className="size-4" aria-hidden />} Remove access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
