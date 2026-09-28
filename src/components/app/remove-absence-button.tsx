"use client";

import { Trash2 } from "lucide-react";
import { removeAbsence } from "@/app/app/actions";
import { ActionButton } from "./action-button";

export function RemoveAbsenceButton({ absenceId }: { absenceId: string }) {
  return (
    <ActionButton variant="ghost" size="icon-lg" className="tap text-muted-foreground hover:text-destructive" action={() => removeAbsence(absenceId)} confirm="Remove this absence and put your shifts back on?">
      <Trash2 className="size-5" aria-hidden />
      <span className="sr-only">Remove absence</span>
    </ActionButton>
  );
}
