"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { OptionSelect } from "@/components/shared/option-select";
import { useDebouncedCallback } from "@/components/admin/use-debounced-callback";
import { cn } from "@/lib/utils";

const TYPE = [
  ["all", "All"],
  ["regular", "Regular"],
  ["harvest", "Harvest pool"],
  ["casual", "Casual"],
];
// "any" means no filter: it is dropped from the URL.
const ROLE = [
  { value: "any", label: "Any role" },
  { value: "WAREHOUSE", label: "Warehouse" },
  { value: "DRIVERS_ASSISTANT", label: "Driver help" },
  { value: "VOLUNTEER_DRIVER", label: "Volunteer driver" },
];
const TRAINING = [
  { value: "any", label: "Any training status" },
  { value: "OVERDUE", label: "Overdue" },
  { value: "DUE_SOON", label: "Due soon" },
  { value: "NOT_STARTED", label: "Not started" },
  { value: "COMPLETE", label: "All current" },
];

export function VolunteerFilters() {
  const router = useRouter();
  const sp = useSearchParams();
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(sp.toString());
    if (v && v !== "any") next.set(k, v); else next.delete(k);
    router.replace(`/admin/volunteers?${next.toString()}`);
  };
  // Typing updates the box at once and the list after a short pause.
  const [q, setQ] = useState(sp.get("q") ?? "");
  const search = useDebouncedCallback((value: string) => set("q", value.trim()));
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full @4xl/admin:w-auto @4xl/admin:min-w-60 @4xl/admin:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input aria-label="Search volunteers" placeholder="Search by name, suburb or email" value={q} onChange={(e) => { setQ(e.target.value); search.run(e.target.value); }} className="h-11 bg-card pl-9 text-base" />
        </div>
        <OptionSelect aria-label="Role" value={sp.get("role") ?? "any"} onValueChange={(v) => set("role", v)} options={ROLE} className="w-auto min-w-44" />
        <OptionSelect aria-label="Training status" value={sp.get("training") ?? "any"} onValueChange={(v) => set("training", v)} options={TRAINING} className="w-auto min-w-52" />
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Volunteer type">
        {TYPE.map(([v, l]) => {
          const active = (sp.get("type") ?? "all") === v;
          return (
            <button key={v} type="button" aria-pressed={active} onClick={() => set("type", v === "all" ? "" : v)} className={cn("flex h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition-colors", active ? "border-teal bg-teal-tint text-teal-deep" : "border-border bg-card text-muted-foreground hover:text-ink")}>
              {active && <Check className="size-4 text-teal" aria-hidden />}
              {l}
            </button>
          );
        })}
      </div>
    </div>
  );
}
