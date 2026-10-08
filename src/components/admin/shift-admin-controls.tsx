"use client";

import { useState } from "react";
import { Check, UserMinus, UserPlus, X, Ban, Phone, Zap } from "lucide-react";
import { addToShift, cancelShift, removeFromShift, setAttendance } from "@/app/admin/actions";
import { ActionButton } from "@/components/app/action-button";
import { AvatarBadge } from "@/components/shared/avatar-badge";
import { Chip } from "@/components/shared/status-chip";
import { Input } from "@/components/ui/input";
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

export function CancelShiftButton({ shiftId }: { shiftId: string }) {
  return (
    <ActionButton variant="outline" size="sm" className="h-10 text-destructive" action={() => cancelShift(shiftId)} confirm="Cancel this shift for everyone?" redirectTo="/admin/roster">
      <Ban className="size-4" /> Cancel shift
    </ActionButton>
  );
}

export function SourceChip({ source }: { source: string }) {
  if (source === "COVER") return <Chip tone="info" size="sm">Covering</Chip>;
  if (source === "REGULAR") return <span className="text-xs text-muted-foreground">Regular</span>;
  if (source === "ADMIN") return <span className="text-xs text-muted-foreground">Added by coordinator</span>;
  return <span className="text-xs text-muted-foreground">Booked</span>;
}
