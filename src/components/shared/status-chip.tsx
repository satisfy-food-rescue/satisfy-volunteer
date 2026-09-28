import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Clock,
  MinusCircle,
  type LucideIcon,
} from "lucide-react";
import type { TrainingStatus } from "@/lib/domain";
import { TRAINING_STATUS_LABEL } from "@/lib/domain";
import { cn } from "@/lib/utils";

export type Tone = "good" | "warn" | "bad" | "neutral" | "info" | "muted";

const TONE_CLASS: Record<Tone, string> = {
  good: "bg-status-good-bg text-status-good",
  warn: "bg-status-warn-bg text-status-warn",
  bad: "bg-status-bad-bg text-status-bad",
  neutral: "bg-status-neutral-bg text-status-neutral",
  info: "bg-status-info-bg text-status-info",
  muted: "bg-transparent text-muted-foreground border border-dashed border-border",
};

// Status is never colour alone: every chip carries an icon and a text label.
export function Chip({
  tone = "neutral",
  icon: Icon,
  children,
  className,
  size = "md",
}: {
  tone?: Tone;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-semibold",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm",
        TONE_CLASS[tone],
        className,
      )}
    >
      {Icon && <Icon className={size === "sm" ? "size-3.5" : "size-4"} aria-hidden />}
      {children}
    </span>
  );
}

export const TRAINING_TONE: Record<TrainingStatus, Tone> = {
  COMPLETE: "good",
  DUE_SOON: "warn",
  OVERDUE: "bad",
  NOT_STARTED: "neutral",
  NOT_REQUIRED: "muted",
};

const TRAINING_ICON: Record<TrainingStatus, LucideIcon> = {
  COMPLETE: CheckCircle2,
  DUE_SOON: Clock,
  OVERDUE: AlertTriangle,
  NOT_STARTED: Circle,
  NOT_REQUIRED: MinusCircle,
};

export function TrainingChip({
  status,
  size,
  className,
}: {
  status: TrainingStatus;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <Chip tone={TRAINING_TONE[status]} icon={TRAINING_ICON[status]} size={size} className={className}>
      {TRAINING_STATUS_LABEL[status]}
    </Chip>
  );
}
