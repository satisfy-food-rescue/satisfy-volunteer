"use client";

import { useState } from "react";
import { BookOpenCheck, FileSignature } from "lucide-react";
import type { DocumentAcceptance } from "@/lib/domain";
import { signAgreements } from "@/app/app/actions";
import { ActionButton } from "@/components/app/action-button";
import { Checkbox } from "@/components/ui/checkbox";

type ToSign = { id: string; version: number; title: string; updated: boolean; acceptance: DocumentAcceptance };

/** One tick box per document, then one button: they are accepted together,
 *  the way they would be on paper. An agreement is signed ("I agree"); a
 *  document such as the job description is read and understood, not signed. */
export function AgreementSigning({ agreements, firstName }: { agreements: ToSign[]; firstName: string }) {
  const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set());
  const all = agreements.every((a) => ticked.has(a.id));
  const toggle = (id: string, on: boolean) => setTicked((t) => (on ? new Set([...t, id]) : new Set([...t].filter((x) => x !== id))));
  const signing = agreements.filter((a) => a.acceptance !== "READ").length;
  const reading = agreements.length - signing;
  const one = agreements.length === 1;
  const heading = reading === 0 ? `Sign ${one ? "it" : "them"}, ${firstName}` : signing === 0 ? `Confirm you have read ${one ? "it" : "them"}, ${firstName}` : `Confirm and sign, ${firstName}`;
  const button = reading === 0 ? (one ? "Sign the agreement" : `Sign ${agreements.length === 2 ? "both" : "all"} agreements`) : signing === 0 ? "Confirm" : "Confirm and sign";
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-teal/40 bg-teal-tint-soft p-4 @3xl/app:p-5">
      <p className="font-bold text-ink">{heading}</p>
      <ul className="flex flex-col gap-2">
        {agreements.map((a) => (
          <li key={a.id}>
            <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl bg-card p-3 ring-1 ring-border has-[[data-checked]]:ring-teal">
              <Checkbox className="mt-0.5 size-5" checked={ticked.has(a.id)} onCheckedChange={(on) => toggle(a.id, on)} />
              <span className="text-ink">
                {a.acceptance === "READ" ? (
                  <>I have read and understood {a.updated ? "the updated" : "the"} <span className="font-semibold">{a.title}</span>.</>
                ) : (
                  <>I have read {a.updated ? "the updated" : "the"} <span className="font-semibold">{a.title}</span> and agree to it.</>
                )}
              </span>
            </label>
          </li>
        ))}
      </ul>
      <ActionButton className="h-12 text-base @3xl/app:self-start @3xl/app:px-8" disabled={!all} action={() => signAgreements({ agreements: agreements.map((a) => ({ id: a.id, version: a.version })) })}>
        {signing === 0 ? <BookOpenCheck className="size-5" aria-hidden /> : <FileSignature className="size-5" aria-hidden />} {button}
      </ActionButton>
      {!all && <p className="text-sm text-muted-foreground">Tick {one ? "the box" : "each box"} once you have read {one ? "it" : "them"}.</p>}
    </div>
  );
}
