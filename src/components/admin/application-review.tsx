"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2, X } from "lucide-react";
import { approveApplication, declineApplication } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function ApplicationReview({ id, firstName }: { id: string; firstName: string }) {
  const [declining, setDeclining] = useState(false);
  const [note, setNote] = useState("");
  const [pending, run] = useTransition();
  const router = useRouter();
  const go = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) => run(async () => { const r = await fn(); if (r.ok) { toast.success(r.message); router.refresh(); } else toast.error(r.error); });
  if (declining) {
    return (
      <div className="flex flex-col gap-2">
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Reason (kept on file, not emailed automatically)" className="text-base" aria-label="Decline reason" />
        <div className="flex gap-2">
          <Button variant="destructive" size="sm" className="h-10" disabled={pending} onClick={() => go(() => declineApplication(id, note))}>{pending ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />} Confirm decline</Button>
          <Button variant="ghost" size="sm" className="h-10" onClick={() => setDeclining(false)}>Back</Button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="lg" className="h-11" disabled={pending} onClick={() => go(() => approveApplication(id))}>{pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Approve {firstName}</Button>
      <Button variant="outline" size="lg" className="h-11" disabled={pending} onClick={() => setDeclining(true)}><X className="size-4" /> Decline</Button>
    </div>
  );
}
