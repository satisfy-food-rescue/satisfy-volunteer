import { CalendarOff, Plane, Thermometer, type LucideIcon } from "lucide-react";
import { ABSENCE_REASON_LABEL, type AbsenceReason } from "@/lib/domain";
import { Chip, type Tone } from "@/components/shared/status-chip";

// One look for each absence reason wherever it shows. Orange stays reserved
// for shifts that need cover, so no reason uses the warn tone.
const REASON_TONE: Record<AbsenceReason, Tone> = { HOLIDAY: "info", SICK: "neutral", OTHER: "neutral" };
const REASON_ICON: Record<AbsenceReason, LucideIcon> = { HOLIDAY: Plane, SICK: Thermometer, OTHER: CalendarOff };

export function AbsenceReasonChip({ reason, size = "sm" }: { reason: AbsenceReason; size?: "sm" | "md" }) {
  return (
    <Chip tone={REASON_TONE[reason]} icon={REASON_ICON[reason]} size={size}>
      {ABSENCE_REASON_LABEL[reason]}
    </Chip>
  );
}
