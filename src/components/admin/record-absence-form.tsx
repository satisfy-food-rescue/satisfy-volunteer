"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarOff, Loader2 } from "lucide-react";
import { recordAbsence } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function RecordAbsenceForm({ volunteers, today, defaultVolunteerId }: { volunteers: { id: string; name: string }[]; today: string; defaultVolunteerId?: string }) {
  const router = useRouter();
  const [volunteerId, setVolunteerId] = useState(defaultVolunteerId ?? volunteers[0]?.id ?? "");
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [reason, setReason] = useState<"HOLIDAY" | "SICK" | "OTHER">("SICK");
  const [note, setNote] = useState("");
  const [pending, run] = useTransition();
  return (
    <form
      className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(async () => {
          const r = await recordAbsence({ volunteerId, startDate: start, endDate: end, reason, note });
          if (r.ok) { toast.success(r.message); router.refresh(); setNote(""); } else toast.error(r.error);
        });
      }}
    >
      {!defaultVolunteerId && (
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="ab-vol">Volunteer</Label>
          <select id="ab-vol" value={volunteerId} onChange={(e) => setVolunteerId(e.target.value)} className="h-11 rounded-lg border border-input bg-card px-3 text-base text-ink focus-visible:outline-3 focus-visible:outline-green">
            {volunteers.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ab-start">From</Label>
        <Input id="ab-start" type="date" value={start} onChange={(e) => { setStart(e.target.value); if (e.target.value > end) setEnd(e.target.value); }} className="h-11 text-base" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ab-end">To</Label>
        <Input id="ab-end" type="date" min={start} value={end} onChange={(e) => setEnd(e.target.value)} className="h-11 text-base" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ab-reason">Reason</Label>
        <select id="ab-reason" value={reason} onChange={(e) => setReason(e.target.value as typeof reason)} className="h-11 rounded-lg border border-input bg-card px-3 text-base text-ink focus-visible:outline-3 focus-visible:outline-green">
          <option value="SICK">Sick</option>
          <option value="HOLIDAY">Holiday</option>
          <option value="OTHER">Other</option>
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ab-note">Note</Label>
        <Textarea id="ab-note" rows={1} value={note} onChange={(e) => setNote(e.target.value)} className="min-h-11 text-base" placeholder="Optional" />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" size="lg" className="h-11" disabled={pending || !volunteerId}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <CalendarOff className="size-4" />} Record absence
        </Button>
      </div>
    </form>
  );
}
