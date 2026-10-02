"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarOff, Loader2 } from "lucide-react";
import { recordAbsence } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { OptionSelect } from "@/components/shared/option-select";

const REASONS = [
  { value: "SICK", label: "Sick" },
  { value: "HOLIDAY", label: "Holiday" },
  { value: "OTHER", label: "Other" },
] as const;

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
          <OptionSelect id="ab-vol" value={volunteerId} onValueChange={setVolunteerId} options={volunteers.map((v) => ({ value: v.id, label: v.name }))} />
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ab-start">From</Label>
        <DatePicker id="ab-start" value={start} onChange={(v) => { setStart(v); if (v > end) setEnd(v); }} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ab-end">To</Label>
        <DatePicker id="ab-end" min={start} value={end} onChange={setEnd} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ab-reason">Reason</Label>
        <OptionSelect id="ab-reason" value={reason} onValueChange={setReason} options={[...REASONS]} />
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
