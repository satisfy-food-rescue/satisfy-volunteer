"use client";

import { useEffect, useRef, useState, useTransition } from "react";
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  // Set when the form closes, so focus goes back to the button that opened it
  // rather than falling to the top of the page.
  const restoreFocus = useRef(false);

  useEffect(() => {
    if (!open && restoreFocus.current) {
      restoreFocus.current = false;
      triggerRef.current?.focus();
    }
  }, [open]);

  const close = () => {
    restoreFocus.current = true;
    setOpen(false);
  };

  if (!open) {
    return (
      <Button ref={triggerRef} variant="outline" className="h-11 self-start text-base" onClick={() => setOpen(true)}>
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
          if (r.ok) { toast.success(r.message); setMessage(""); close(); router.refresh(); } else toast.error(r.error);
        });
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !pending) close();
      }}
    >
      <Label htmlFor="role-request" className="text-base">What would you like to change?</Label>
      {/* Opened by an explicit tap, so moving focus into the field is expected. */}
      <Textarea id="role-request" autoFocus rows={3} value={message} onChange={(e) => setMessage(e.target.value)} className="text-base" placeholder="e.g. I'd like to try driver help on Fridays" />
      <div className="flex gap-2">
        <Button type="submit" className="h-11 flex-1 text-base" disabled={pending || message.trim().length < 3}>
          {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Send className="size-5" aria-hidden />} Send request
        </Button>
        <Button type="button" variant="ghost" className="h-11 px-4 text-base" disabled={pending} onClick={close}>Cancel</Button>
      </div>
    </form>
  );
}
