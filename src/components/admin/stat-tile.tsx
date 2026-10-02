import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
  href,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  tone?: "neutral" | "good" | "warn" | "bad" | "info";
  href?: string;
}) {
  const toneCls = {
    neutral: "bg-muted text-ink",
    good: "bg-status-good-bg text-status-good",
    warn: "bg-status-warn-bg text-status-warn",
    bad: "bg-status-bad-bg text-status-bad",
    info: "bg-status-info-bg text-status-info",
  }[tone];
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-muted-foreground">{label}</p>
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", toneCls)}>
          <Icon className="size-5" aria-hidden />
        </span>
      </div>
      <p className="mt-2 font-display font-bold text-3xl text-ink tabular">{value}</p>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
    </>
  );
  const cls = "flex flex-col rounded-2xl border border-border bg-card p-4 shadow-sm";
  return href ? (
    <Link href={href} className={cn(cls, "transition-colors hover:border-green")}>{body}</Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
