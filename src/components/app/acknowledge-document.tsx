"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { acknowledgeDocument } from "@/app/app/actions";
import { ActionButton } from "@/components/app/action-button";
import { Checkbox } from "@/components/ui/checkbox";

/** "I have read it": a tick box, then confirm. Recorded against this version,
 *  so the coordinator can see who has read the latest. */
export function AcknowledgeDocument({ documentId, version, title, updated }: { documentId: string; version: number; title: string; updated: boolean }) {
  const [ticked, setTicked] = useState(false);
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-teal/40 bg-teal-tint-soft p-4 @3xl/app:p-5">
      <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl bg-card p-3 ring-1 ring-border has-[[data-checked]]:ring-teal">
        <Checkbox className="mt-0.5 size-5" checked={ticked} onCheckedChange={setTicked} />
        <span className="text-ink">
          I have read {updated ? "the updated" : "the"} <span className="font-semibold">{title}</span>.
        </span>
      </label>
      <ActionButton className="h-12 text-base @3xl/app:self-start @3xl/app:px-8" disabled={!ticked} action={() => acknowledgeDocument(documentId, version)}>
        <Check className="size-5" aria-hidden /> Confirm
      </ActionButton>
    </div>
  );
}
