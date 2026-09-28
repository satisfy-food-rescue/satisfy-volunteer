"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";
import { completeOnlineModule } from "@/app/app/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ConfirmModuleForm({ moduleId, moduleName }: { moduleId: string; moduleName: string }) {
  const [checked, setChecked] = useState(false);
  const [pending, run] = useTransition();
  const router = useRouter();
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-green/40 bg-green-tint-soft p-5">
      <label className={cn("flex cursor-pointer items-start gap-3 rounded-xl border bg-white p-4 transition-colors has-focus-visible:outline-3 has-focus-visible:outline-green", checked ? "border-green" : "border-border")}>
        <input type="checkbox" className="mt-1 size-5 shrink-0 accent-[var(--brand-green)]" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
        <span className="text-base leading-snug text-ink">
          I have read and understood the {moduleName} refresher and will follow it on every shift.
        </span>
      </label>
      <Button
        size="lg"
        className="h-12 text-base"
        disabled={!checked || pending}
        onClick={() =>
          run(async () => {
            const r = await completeOnlineModule(moduleId);
            if (r.ok) {
              toast.success(r.message);
              router.push("/app/training");
              router.refresh();
            } else toast.error(r.error);
          })
        }
      >
        {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <CheckCircle2 className="size-5" aria-hidden />}
        Confirm and record completion
      </Button>
    </div>
  );
}
