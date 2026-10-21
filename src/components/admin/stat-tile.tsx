import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** A headline number. The icon only says what is counted, so it is always
 *  the same colour; anything worth flagging belongs in the hint, in words.
 *  The label row is as tall as two lines of label, so numbers line up across
 *  a row of tiles whichever labels wrap. */
export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  href,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  href?: string;
}) {
  const body = (
    <>
      <div className="flex min-h-9 items-center justify-between gap-3">
        <p className="line-clamp-2 text-sm font-semibold leading-tight text-muted-foreground">{label}</p>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-teal-tint text-teal">
          <Icon className="size-5" aria-hidden />
        </span>
      </div>
      <p className="mt-2 font-display font-bold text-3xl text-ink tabular">{value}</p>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
    </>
  );
  const cls = "flex flex-col rounded-2xl border border-border bg-card p-4 shadow-sm";
  return href ? (
    <Link href={href} className={cn(cls, "transition-colors hover:border-teal/60")}>{body}</Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
