"use client";

import { useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { OptionSelect } from "@/components/shared/option-select";
import { ROLE_LABEL, VOLUNTEER_ROLES } from "@/lib/domain";

const STATUS = [
  { value: "active", label: "Active volunteers" },
  { value: "all", label: "Active and inactive" },
] as const;

const ROLES = [{ value: "any", label: "Any role" }, ...VOLUNTEER_ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))];

/** Picks who goes in the volunteer report, then downloads it as a CSV. */
export function ReportDownload({ today }: { today: string }) {
  const [status, setStatus] = useState<string>("active");
  const [role, setRole] = useState<string>("any");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const params = new URLSearchParams();
  if (status !== "active") params.set("status", status);
  if (role !== "any") params.set("role", role);
  if (from) params.set("joinedFrom", from);
  if (to) params.set("joinedTo", to);
  const href = `/admin/reports/volunteers.csv${params.size ? `?${params}` : ""}`;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 @xl/admin:grid-cols-2 @5xl/admin:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rep-status">Who</Label>
          <OptionSelect id="rep-status" value={status} onValueChange={setStatus} options={[...STATUS]} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rep-role">Role</Label>
          <OptionSelect id="rep-role" value={role} onValueChange={setRole} options={ROLES} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rep-from">Joined from <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <DatePicker id="rep-from" value={from} max={to || today} onChange={setFrom} placeholder="Any date" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rep-to">Joined up to <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <DatePicker id="rep-to" value={to} min={from || undefined} max={today} onChange={setTo} placeholder="Any date" />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button render={<a href={href} download />} className="h-11 px-5">
          <Download className="size-4" aria-hidden /> Download CSV
        </Button>
        {(from || to) && (
          <Button variant="ghost" className="h-11" onClick={() => { setFrom(""); setTo(""); }}>
            <X className="size-4" aria-hidden /> Clear dates
          </Button>
        )}
      </div>
    </div>
  );
}
