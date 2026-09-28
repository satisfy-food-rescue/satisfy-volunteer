"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save, ClipboardCheck } from "lucide-react";
import { recordCoordinatorCompletion, saveVolunteerNotes, setVolunteerRoles } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ActionButton } from "@/components/app/action-button";
import { ROLE_LABEL, VOLUNTEER_ROLES, type VolunteerRole } from "@/lib/domain";
import { cn } from "@/lib/utils";

export function NotesEditor({ volunteerId, initial }: { volunteerId: string; initial: string }) {
  const [notes, setNotes] = useState(initial);
  const [pending, run] = useTransition();
  const router = useRouter();
  return (
    <div className="flex flex-col gap-2">
      <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className="text-base" placeholder="Private coordinator notes. Volunteers never see these." aria-label="Coordinator notes" />
      <Button size="sm" className="h-10 self-end" disabled={pending || notes === initial} onClick={() => run(async () => { const r = await saveVolunteerNotes(volunteerId, notes); if (r.ok) { toast.success(r.message); router.refresh(); } else toast.error(r.error); })}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save notes
      </Button>
    </div>
  );
}

export function RolesEditor({ volunteerId, initial }: { volunteerId: string; initial: VolunteerRole[] }) {
  const [roles, setRoles] = useState<VolunteerRole[]>(initial);
  const [pending, run] = useTransition();
  const router = useRouter();
  const changed = roles.join() !== initial.join();
  return (
    <div className="flex flex-wrap items-center gap-2">
      {VOLUNTEER_ROLES.map((r) => {
        const on = roles.includes(r);
        return (
          <label key={r} className={cn("flex h-10 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm font-semibold transition-colors has-focus-visible:outline-3 has-focus-visible:outline-green", on ? "border-green bg-green-tint text-green-deep" : "border-border bg-card text-muted-foreground")}>
            <input type="checkbox" className="sr-only" checked={on} onChange={() => setRoles(on ? roles.filter((x) => x !== r) : VOLUNTEER_ROLES.filter((x) => x === r || roles.includes(x)))} />
            {ROLE_LABEL[r]}
          </label>
        );
      })}
      {changed && (
        <Button size="sm" className="h-10" disabled={pending} onClick={() => run(async () => { const res = await setVolunteerRoles(volunteerId, roles); if (res.ok) { toast.success(res.message); router.refresh(); } else toast.error(res.error); })}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save roles
        </Button>
      )}
    </div>
  );
}

export function RecordCompletionButton({ volunteerId, moduleId, moduleName }: { volunteerId: string; moduleId: string; moduleName: string }) {
  return (
    <ActionButton size="sm" variant="outline" className="h-9" action={() => recordCoordinatorCompletion(volunteerId, moduleId)} confirm={`Record ${moduleName} as completed today?`}>
      <ClipboardCheck className="size-4" /> Record today
    </ActionButton>
  );
}
