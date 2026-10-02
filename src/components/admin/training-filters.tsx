"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Tabs } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { OptionSelect, type Option } from "@/components/shared/option-select";

/** Tabs whose selection lives in the URL (?tab=), so links can open a tab with
 *  filters already applied. */
export function UrlTabs({ value, className, children }: { value: string; className?: string; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  return (
    <Tabs
      value={value}
      className={className}
      onValueChange={(tab) => {
        const next = new URLSearchParams(sp.toString());
        next.set("tab", String(tab));
        router.replace(`${pathname}?${next.toString()}`, { scroll: false });
      }}
    >
      {children}
    </Tabs>
  );
}

// "any" and the default status are dropped from the URL.
export const STATUS_OPTIONS: Option[] = [
  { value: "attention", label: "Needs attention" },
  { value: "OVERDUE", label: "Overdue" },
  { value: "DUE_SOON", label: "Due soon" },
  { value: "NOT_STARTED", label: "Not started" },
  { value: "COMPLETE", label: "Complete" },
  { value: "all", label: "Any status" },
];

export const EXPIRY_OPTIONS: Option[] = [
  { value: "any", label: "Any expiry" },
  { value: "expired", label: "Already expired" },
  { value: "30", label: "Expires within 30 days" },
  { value: "90", label: "Expires within 90 days" },
];

const DEFAULTS: Record<string, string> = { module: "any", status: "attention", expiry: "any", q: "" };

export function TrainingRecordFilters({ modules }: { modules: Option[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(sp.toString());
    next.set("tab", "people");
    if (v && v !== DEFAULTS[k]) next.set(k, v); else next.delete(k);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };
  const filtered = ["module", "status", "expiry", "q"].some((k) => sp.has(k));
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-60 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input aria-label="Search by volunteer" placeholder="Search by volunteer" value={q} onChange={(e) => { setQ(e.target.value); set("q", e.target.value.trim()); }} className="h-11 bg-card pl-9 text-base" />
      </div>
      <OptionSelect aria-label="Module" value={sp.get("module") ?? "any"} onValueChange={(v) => set("module", v)} options={[{ value: "any", label: "Any module" }, ...modules]} className="w-auto min-w-52" />
      <OptionSelect aria-label="Status" value={sp.get("status") ?? "attention"} onValueChange={(v) => set("status", v)} options={STATUS_OPTIONS} className="w-auto min-w-44" />
      <OptionSelect aria-label="Expiry" value={sp.get("expiry") ?? "any"} onValueChange={(v) => set("expiry", v)} options={EXPIRY_OPTIONS} className="w-auto min-w-52" />
      {filtered && (
        <button type="button" onClick={() => { setQ(""); router.replace(`${pathname}?tab=people`, { scroll: false }); }} className="flex h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-ink">
          <X className="size-4" aria-hidden /> Clear filters
        </button>
      )}
    </div>
  );
}
