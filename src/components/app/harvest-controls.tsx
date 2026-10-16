"use client";

import { setHarvestPool } from "@/app/app/actions";
import { ActionButton } from "./action-button";

export function HarvestPoolToggle({ inPool }: { inPool: boolean }) {
  return (
    <ActionButton variant={inPool ? "outline" : "default"} className="h-12 w-full text-base" action={() => setHarvestPool(!inPool)} confirm={inPool ? { title: "Leave the harvest pool?", description: "You will stop hearing about new harvests. Any harvest you are already booked on stays booked.", confirmLabel: "Leave the pool", cancelLabel: "Stay in the pool" } : undefined}>
      {inPool ? "Leave the harvest pool" : "Count me in for harvests"}
    </ActionButton>
  );
}
