"use client";

import { Check, X } from "lucide-react";
import { rsvpHarvest, setHarvestPool } from "@/app/app/actions";
import { ActionButton } from "./action-button";

export function HarvestPoolToggle({ inPool }: { inPool: boolean }) {
  return (
    <ActionButton variant={inPool ? "outline" : "default"} className="h-12 w-full text-base" action={() => setHarvestPool(!inPool)}>
      {inPool ? "Leave the harvest pool" : "Count me in for harvests"}
    </ActionButton>
  );
}

export function HarvestRsvp({ calloutId, status }: { calloutId: string; status: string | null }) {
  if (status === "GOING") {
    return (
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 font-semibold text-green-text"><Check className="size-5" aria-hidden /> You&apos;re going</span>
        <ActionButton variant="ghost" size="sm" className="h-11 px-3 text-muted-foreground" action={() => rsvpHarvest(calloutId, false)}>Can&apos;t make it</ActionButton>
      </div>
    );
  }
  return (
    <div className="flex gap-2">
      <ActionButton className="h-11 flex-1 text-base" action={() => rsvpHarvest(calloutId, true)}><Check className="size-5" aria-hidden /> I can come</ActionButton>
      {status !== "DECLINED" && (
        <ActionButton variant="outline" className="h-11 px-3 text-base" action={() => rsvpHarvest(calloutId, false)}><X className="size-5" aria-hidden /> Not this time</ActionButton>
      )}
    </div>
  );
}
