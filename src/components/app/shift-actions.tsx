"use client";

import Link from "next/link";
import { CheckCircle2, HandHelping, Lock } from "lucide-react";
import { bookShift, cancelBooking } from "@/app/app/actions";
import { ActionButton } from "./action-button";
import { Button } from "@/components/ui/button";

export type ShiftActionState = {
  shiftId: string;
  mine: { id: string; source: string } | null;
  isPast: boolean;
  isFull: boolean;
  isGap: boolean;
  eligible: boolean;
  reason: string | null;
  blockerModuleCode: string | null;
};

export function ShiftActions({ state, compact = false }: { state: ShiftActionState; compact?: boolean }) {
  if (state.isPast) return null;
  if (state.mine) {
    return (
      <div className="flex flex-col gap-3">
        <p className="inline-flex items-center gap-2 font-semibold text-green-text">
          <CheckCircle2 className="size-5" aria-hidden />
          {state.mine.source === "REGULAR" ? "This is your regular slot" : state.mine.source === "COVER" ? "You're covering this shift" : "You're booked on"}
        </p>
        {!compact &&
          (state.mine.source === "REGULAR" ? (
            <Button variant="outline" size="lg" className="h-12 text-base" render={<Link href="/app/slot" />}>
              Going to be away? Mark me away
            </Button>
          ) : (
            <ActionButton variant="outline" className="h-12 text-base" action={() => cancelBooking(state.mine!.id)} confirm="Cancel this booking?">
              Cancel my booking
            </ActionButton>
          ))}
      </div>
    );
  }
  if (!state.eligible) {
    return (
      <div className="rounded-xl border border-status-warn/30 bg-status-warn-bg p-4 text-status-warn">
        <p className="flex items-start gap-2 font-semibold">
          <Lock className="mt-0.5 size-5 shrink-0" aria-hidden />
          <span>{state.reason}</span>
        </p>
        <Button
          variant="outline"
          size="lg"
          className="mt-3 h-12 w-full border-status-warn/40 bg-white text-base text-status-warn hover:bg-white"
          render={<Link href={state.blockerModuleCode ? `/app/training/${state.blockerModuleCode}` : "/app/training"} />}
        >
          Go to training
        </Button>
      </div>
    );
  }
  if (state.isFull) {
    return <p className="font-semibold text-muted-foreground">This shift is full.</p>;
  }
  return (
    <ActionButton
      className={state.isGap ? "h-12 w-full bg-orange text-base text-ink hover:bg-orange-hover" : "h-12 w-full text-base"}
      action={() => bookShift(state.shiftId)}
    >
      {state.isGap && <HandHelping className="size-5" aria-hidden />}
      {state.isGap ? "I can cover this" : "Book this shift"}
    </ActionButton>
  );
}
