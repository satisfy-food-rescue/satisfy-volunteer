"use client";

import { Check, X } from "lucide-react";
import { rsvpSession } from "@/app/app/actions";
import { ActionButton } from "./action-button";

export function SessionRsvp({ sessionId, status, full }: { sessionId: string; status: string | null; full: boolean }) {
  if (status === "GOING") {
    return (
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 font-semibold text-green-text">
          <Check className="size-5" aria-hidden /> You&apos;re booked in
        </span>
        <ActionButton variant="ghost" size="sm" className="h-11 px-3 text-muted-foreground" action={() => rsvpSession(sessionId, false)}>
          Can&apos;t make it
        </ActionButton>
      </div>
    );
  }
  return (
    <div className="flex gap-2">
      <ActionButton className="h-11 flex-1 text-base" action={() => rsvpSession(sessionId, true)} disabled={full}>
        <Check className="size-5" aria-hidden /> {full ? "Session full" : "I'll be there"}
      </ActionButton>
      {status !== "DECLINED" && (
        <ActionButton variant="outline" className="h-11 px-3 text-base" action={() => rsvpSession(sessionId, false)}>
          <X className="size-5" aria-hidden /> Can&apos;t
        </ActionButton>
      )}
    </div>
  );
}
