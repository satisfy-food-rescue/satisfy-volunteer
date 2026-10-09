"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, UserMinus, UserPlus, X, Ban, Loader2, Phone, Zap } from "lucide-react";
import { addToShift, cancelShift, removeFromShift, setAttendance } from "@/app/admin/actions";
import { ActionButton } from "@/components/app/action-button";
import { AvatarBadge } from "@/components/shared/avatar-badge";
import { Chip } from "@/components/shared/status-chip";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fullName } from "@/lib/domain";
import { cn } from "@/lib/utils";

export function AttendanceControls({ assignmentId, status, isPast }: { assignmentId: string; status: string; isPast: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      {isPast ? (
        <>
          <ActionButton size="sm" variant={status === "ATTENDED" ? "default" : "outline"} className="h-9 px-2.5" action={() => setAttendance(assignmentId, status === "ATTENDED" ? "CONFIRMED" : "ATTENDED")}>
            <Check className="size-4" /> Attended
          </ActionButton>
          <ActionButton size="sm" variant={status === "NO_SHOW" ? "destructive" : "outline"} className="h-9 px-2.5" action={() => setAttendance(assignmentId, status === "NO_SHOW" ? "CONFIRMED" : "NO_SHOW")}>
            <X className="size-4" /> No-show
          </ActionButton>
        </>
      ) : (
        <ActionButton size="sm" variant="ghost" className="h-9 px-2.5 text-muted-foreground hover:text-destructive" action={() => removeFromShift(assignmentId)} confirm="Remove this volunteer from the shift?">
          <UserMinus className="size-4" /> Remove
        </ActionButton>
      )}
    </div>
  );
}

export type Candidate = {
  id: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  lastMinuteOk: boolean;
  coversBefore: number;
  roles: string;
};

export function AddVolunteerPanel({ shiftId, candidates, isGap }: { shiftId: string; candidates: Candidate[]; isGap: boolean }) {
  const [q, setQ] = useState("");
  const filtered = candidates.filter((c) => fullName(c).toLowerCase().includes(q.toLowerCase()));
  const lastMinute = filtered.filter((c) => c.lastMinuteOk);
  const others = filtered.filter((c) => !c.lastMinuteOk);
  const Row = ({ c }: { c: Candidate }) => (
    <li className="flex items-center gap-3 px-3 py-2">
      <AvatarBadge person={c} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-ink">{fullName(c)}</span>
        <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          {c.phone && <span className="inline-flex items-center gap-1 tabular"><Phone className="size-3" aria-hidden />{c.phone}</span>}
          {c.coversBefore > 0 && <span>Covered {c.coversBefore}x before</span>}
        </span>
      </span>
      <ActionButton size="sm" className={cn("h-9 px-3", isGap && "bg-orange text-ink hover:bg-orange-hover")} action={() => addToShift(shiftId, c.id)}>
        <UserPlus className="size-4" /> Add
      </ActionButton>
    </li>
  );
  return (
    <div className="flex flex-col gap-3">
      <Input placeholder="Search eligible volunteers" value={q} onChange={(e) => setQ(e.target.value)} className="h-11 text-base" aria-label="Search eligible volunteers" />
      {lastMinute.length > 0 && (
        <div>
          <p className="font-display mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-orange-text"><Zap className="size-3.5" aria-hidden /> Last-minute available</p>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-orange/50 bg-card">{lastMinute.map((c) => <Row key={c.id} c={c} />)}</ul>
        </div>
      )}
      <div>
        <p className="font-display mb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">Eligible and free ({others.length})</p>
        {others.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">No other eligible volunteers are free that day.</p>
        ) : (
          <ul className="max-h-80 divide-y divide-border overflow-y-auto rounded-xl border border-border bg-card">{others.map((c) => <Row key={c.id} c={c} />)}</ul>
        )}
      </div>
    </div>
  );
}

export function CancelShiftButton({ shiftId, label, booked }: { shiftId: string; label: string; booked: number }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const submit = () =>
    start(async () => {
      const r = await cancelShift({ shiftId, reason });
      if (r.ok) {
        toast.success(r.message);
        setOpen(false);
        router.push("/admin/roster");
        router.refresh();
      } else toast.error(r.error);
    });
  return (
    <>
      <Button variant="outline" size="sm" className="h-10 text-destructive" onClick={() => { setReason(""); setOpen(true); }}>
        <Ban className="size-4" /> Cancel shift
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl text-ink">Cancel this shift?</DialogTitle>
            <DialogDescription>
              <span className="font-semibold text-ink">{label}.</span>{" "}
              {booked === 0
                ? "Nobody is booked on it yet. It comes off the roster for everyone."
                : `The ${booked === 1 ? "volunteer" : `${booked} volunteers`} booked on it will get an email and a push notification straight away, so nobody turns up for it.`}
            </DialogDescription>
          </DialogHeader>
          {booked > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`cancel-reason-${shiftId}`}>Reason (optional)</Label>
              <Textarea id={`cancel-reason-${shiftId}`} value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={200} className="text-base" placeholder="For example, the truck is in for repairs" />
              <p className="text-xs text-muted-foreground">Included in the email to volunteers.</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" className="h-10" disabled={pending} onClick={() => setOpen(false)}>Keep shift</Button>
            <Button variant="destructive" className="h-10" disabled={pending} onClick={submit}>
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Ban className="size-4" />} Cancel shift
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function SourceChip({ source }: { source: string }) {
  if (source === "COVER") return <Chip tone="info" size="sm">Covering</Chip>;
  if (source === "REGULAR") return <span className="text-xs text-muted-foreground">Regular</span>;
  if (source === "ADMIN") return <span className="text-xs text-muted-foreground">Added by coordinator</span>;
  return <span className="text-xs text-muted-foreground">Booked</span>;
}
