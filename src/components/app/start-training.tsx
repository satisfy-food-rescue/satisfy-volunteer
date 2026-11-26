"use client";

import { GraduationCap } from "lucide-react";
import { startTraining } from "@/app/app/actions";
import { ActionButton } from "@/components/app/action-button";

/** For a harvest-only volunteer who would like to help regularly: puts them
 *  in training straight away. Harvests stay open to them. */
export function StartTraining() {
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-teal-tint-soft p-3 ring-1 ring-teal/25">
      <p className="text-sm text-ink">
        <span className="font-semibold">Like to help regularly too?</span> Warehouse sorting and driver help start with an induction and in-person training. You can keep picking at harvests while you train.
      </p>
      <ActionButton
        variant="outline"
        className="h-11 self-start bg-card"
        action={startTraining}
        confirm={{
          title: "Start training for a regular role?",
          description: "Your induction and training stages open on the Training page, and the coordinator is told. Once they are done, the coordinator gives you a role.",
          confirmLabel: "Start training",
          cancelLabel: "Not now",
          destructive: false,
        }}
      >
        <GraduationCap className="size-5" aria-hidden /> Start training
      </ActionButton>
    </div>
  );
}
