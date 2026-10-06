import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const STYLE = {
  error: { icon: AlertTriangle, className: "bg-status-bad-bg text-status-bad" },
  success: { icon: CheckCircle2, className: "bg-status-good-bg text-status-good" },
  info: { icon: Info, className: "bg-status-info-bg text-status-info" },
} as const;

/** Inline message above or below a form. Icon plus text, never colour alone. */
export function FormNotice({ tone, children, className }: { tone: keyof typeof STYLE; children: React.ReactNode; className?: string }) {
  const { icon: Icon, className: toneClass } = STYLE[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("flex gap-2.5 rounded-xl px-3.5 py-3 text-[0.95rem] leading-snug", toneClass, className)}>
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
