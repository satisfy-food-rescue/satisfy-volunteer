"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { requestRoleChange } from "@/app/app/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** Roles change which shifts and training apply, so volunteers ask and a
 *  coordinator makes the change. */
export function RoleChangeRequest() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, run] = useTransition();
  const router = useRouter();
  if (!open) {
    return (
      <Button variant="outline" className="h-11 self-start text-base" onClick={() => setOpen(true)}>
        Ask to change my roles
      </Button>
    );
  }
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(async () => {
          const r = await requestRoleChange(message);
          if (r.ok) { toast.success(r.message); setMessage(""); setOpen(false); router.refresh(); } else toast.error(r.error);
        });
      }}
    >
      <Label htmlFor="role-request" className="text-base">What would you like to change?</Label>
      <Textarea id="role-request" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} className="text-base" placeholder="e.g. I'd like to try driver help on Fridays" />
      <div className="flex gap-2">
        <Button type="submit" className="h-11 flex-1 text-base" disabled={pending || message.trim().length < 3}>
          {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Send className="size-5" aria-hidden />} Send request
        </Button>
        <Button type="button" variant="ghost" className="h-11 px-4 text-base" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  );
}
