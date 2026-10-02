"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type Option<V extends string = string> = { value: V; label: string };

// shadcn Select sized and styled to match the app's form fields (44px tall,
// 16px text). Takes a flat option list so call sites stay one line.
export function OptionSelect<V extends string>({
  id,
  value,
  onValueChange,
  options,
  placeholder,
  className,
  "aria-label": ariaLabel,
}: {
  id?: string;
  value: V;
  onValueChange: (value: V) => void;
  options: Option<V>[];
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <Select items={options} value={value} onValueChange={(v) => onValueChange(v as V)}>
      <SelectTrigger
        id={id}
        aria-label={ariaLabel}
        className={cn("h-11! w-full bg-card pr-2.5 pl-2.5 text-base text-ink hover:border-green/60 data-popup-open:border-ring", className)}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} className="py-2 text-base">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
