"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { deleteMyAccount } from "@/app/app/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** The volunteer's own, final choice. The server action signs them out and
 *  sends them to sign-in, so on success nothing is left to show here. */
export function DeleteAccount() {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const confirm = () =>
    start(async () => {
      const r = await deleteMyAccount();
      // A redirect never returns; only a refusal does.
      if (!r.ok) {
        toast.error(r.error);
        setConfirming(false);
      }
    });
  return (
    <section aria-labelledby="delete-h" className="order-last flex flex-col gap-2 border-t border-border pt-5 @4xl/app:order-none">
      <h2 id="delete-h" className="text-base font-semibold text-ink">Delete my account</h2>
      <p className="text-sm text-muted-foreground">
        Stopping volunteering? Deleting your account signs you out everywhere, takes you off the roster and removes your personal details straight away. It cannot be undone.
      </p>
      <Button variant="ghost" className="h-11 self-start px-3 text-base text-muted-foreground hover:text-status-bad" onClick={() => setConfirming(true)}>
        <Trash2 className="size-5" aria-hidden /> Delete my account
      </Button>
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl text-ink">Delete your account?</DialogTitle>
            <DialogDescription>
              You will be signed out on every device and taken off your regular slot and any upcoming shifts. Your name, contact details, emergency contact and notes are removed straight away, and the coordinator is told you have left.
            </DialogDescription>
            <p className="text-sm text-muted-foreground">
              The shifts and training you completed stay in Satisfy&apos;s records without your name. This cannot be undone: to volunteer again, you would sign up afresh.
            </p>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="h-11" disabled={pending} onClick={() => setConfirming(false)}>Keep my account</Button>
            <Button variant="destructive" className="h-11" disabled={pending} onClick={confirm}>
              {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Trash2 className="size-5" aria-hidden />} Delete my account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
