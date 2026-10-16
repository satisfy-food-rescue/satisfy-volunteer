"use client";

import { setHarvestPool } from "@/app/app/actions";
import { ActionButton } from "./action-button";

export function HarvestPoolToggle({ inPool }: { inPool: boolean }) {
  return (
    <ActionButton variant={inPool ? "outline" : "default"} className="h-12 w-full text-base" action={() => setHarvestPool(!inPool)} confirm={inPool ? "Leave the harvest pool? Harvests you are already booked on stay booked." : undefined}>
      {inPool ? "Leave the harvest pool" : "Count me in for harvests"}
    </ActionButton>
  );
}
