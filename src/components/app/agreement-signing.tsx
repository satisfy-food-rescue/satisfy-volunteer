"use client";

import { useState } from "react";
import { FileSignature } from "lucide-react";
import { signAgreements } from "@/app/app/actions";
import { ActionButton } from "@/components/app/action-button";
import { Checkbox } from "@/components/ui/checkbox";

type ToSign = { id: string; version: number; title: string; updated: boolean };

/** One tick box per agreement, then one button: the agreements are signed
 *  together, the way they would be on paper. */
export function AgreementSigning({ agreements, firstName }: { agreements: ToSign[]; firstName: string }) {
  const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set());
  const all = agreements.every((a) => ticked.has(a.id));
  const toggle = (id: string, on: boolean) => setTicked((t) => (on ? new Set([...t, id]) : new Set([...t].filter((x) => x !== id))));
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-teal/40 bg-teal-tint-soft p-4 @3xl/app:p-5">
      <p className="font-bold text-ink">Sign {agreements.length === 1 ? "it" : "them"}, {firstName}</p>
      <ul className="flex flex-col gap-2">
        {agreements.map((a) => (
          <li key={a.id}>
            <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl bg-card p-3 ring-1 ring-border has-[[data-checked]]:ring-teal">
              <Checkbox className="mt-0.5 size-5" checked={ticked.has(a.id)} onCheckedChange={(on) => toggle(a.id, on)} />
              <span className="text-ink">
                I have read {a.updated ? "the updated" : "the"} <span className="font-semibold">{a.title}</span> and agree to it.
              </span>
            </label>
          </li>
        ))}
      </ul>
      <ActionButton className="h-12 text-base @3xl/app:self-start @3xl/app:px-8" disabled={!all} action={() => signAgreements({ agreements: agreements.map((a) => ({ id: a.id, version: a.version })) })}>
        <FileSignature className="size-5" aria-hidden /> {agreements.length === 1 ? "Sign the agreement" : `Sign ${agreements.length === 2 ? "both" : "all"} agreements`}
      </ActionButton>
      {!all && <p className="text-sm text-muted-foreground">Tick {agreements.length === 1 ? "the box" : "each box"} once you have read {agreements.length === 1 ? "it" : "them"}.</p>}
    </div>
  );
}
