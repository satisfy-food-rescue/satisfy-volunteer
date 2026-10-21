import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** A native <details> whose summary looks like a quiet button with a chevron,
 *  rather than the browser's default triangle. */
export function Disclosure({
  label,
  size = "md",
  className,
  children,
}: {
  label: React.ReactNode;
  size?: "sm" | "md";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <details className={cn("group/disclosure", className)}>
      <summary
        className={cn(
          "inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full border border-border bg-card font-semibold text-teal transition-colors hover:border-teal/60 hover:bg-teal-tint-soft group-open/disclosure:border-teal/60 [&::-webkit-details-marker]:hidden",
          size === "sm" ? "min-h-9 px-3 text-xs" : "min-h-11 px-4 text-sm",
        )}
      >
        {label}
        <ChevronDown className={cn("shrink-0 transition-transform group-open/disclosure:rotate-180", size === "sm" ? "size-3.5" : "size-4")} aria-hidden />
      </summary>
      {children}
    </details>
  );
}
