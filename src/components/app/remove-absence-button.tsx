"use client";

import { Trash2 } from "lucide-react";
import { removeAbsence } from "@/app/app/actions";
import { ActionButton } from "./action-button";

export function RemoveAbsenceButton({ absenceId }: { absenceId: string }) {
  return (
    <ActionButton variant="ghost" size="icon-lg" className="tap text-muted-foreground hover:text-destructive" action={() => removeAbsence(absenceId)} confirm={{ title: "Remove this absence?", description: "Your regular shifts on these dates go back on, except any someone has already picked up to cover.", confirmLabel: "Remove absence", cancelLabel: "Keep absence" }}>
      <Trash2 className="size-5" aria-hidden />
      <span className="sr-only">Remove absence</span>
    </ActionButton>
  );
}
