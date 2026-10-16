"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { ActionResult } from "@/lib/volunteer-actions";
import { cn } from "@/lib/utils";

/** What to ask before running the action. */
export type ConfirmSpec = {
  /** The question, e.g. "Cancel this booking?" */
  title: string;
  /** What happens if they go ahead. */
  description?: string;
  /** The confirm button, named after the action, e.g. "Cancel booking". */
  confirmLabel: string;
  /** The way out, e.g. "Keep booking". */
  cancelLabel?: string;
  /** Styles the confirm button as destructive. Defaults to true. */
  destructive?: boolean;
};

/** A bare question still works: "Delete this draft? Nobody is told." becomes
 *  the title and the rest the description. */
function toSpec(confirm: string | ConfirmSpec): ConfirmSpec {
  if (typeof confirm !== "string") return confirm;
  const at = confirm.indexOf("? ");
  return at === -1
    ? { title: confirm, confirmLabel: "Confirm" }
    : { title: confirm.slice(0, at + 1), description: confirm.slice(at + 2), confirmLabel: "Confirm" };
}

/** Generic mutation button: runs a server action, toasts the result, refreshes.
 *  With `confirm`, it asks first in an alert dialog. */
export function ActionButton({
  action,
  children,
  className,
  variant = "default",
  size = "lg",
  redirectTo,
  confirm,
  disabled,
}: {
  action: () => Promise<ActionResult>;
  children: React.ReactNode;
  className?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  redirectTo?: string;
  confirm?: string | ConfirmSpec;
  disabled?: boolean;
}) {
  const [pending, start] = useTransition();
  const [asking, setAsking] = useState(false);
  const router = useRouter();
  const spinnerSize = size === "lg" || size === "icon-lg" ? "size-5" : "size-4";

  const run = () =>
    start(async () => {
      const result = await action();
      setAsking(false);
      if (result.ok) {
        toast.success(result.message ?? "Done");
        if (redirectTo) router.push(redirectTo);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });

  const button = (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={disabled || pending}
      // While pending the spinner stands in for the button's own icon, so an
      // icon-only button shows just the spinner (its sr-only label stays).
      className={cn(pending && "[&>svg:not([data-spinner])]:hidden", className)}
      onClick={confirm ? undefined : run}
    >
      {pending && <Loader2 data-spinner className={cn(spinnerSize, "animate-spin")} aria-hidden />}
      {children}
    </Button>
  );

  if (!confirm) return button;
  const spec = toSpec(confirm);

  return (
    <AlertDialog open={asking} onOpenChange={(open) => !pending && setAsking(open)}>
      <AlertDialogTrigger render={button} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl text-ink">{spec.title}</AlertDialogTitle>
          {spec.description && <AlertDialogDescription className="text-base">{spec.description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel variant="ghost" className="h-11 text-base" disabled={pending}>
            {spec.cancelLabel ?? "Keep"}
          </AlertDialogCancel>
          <AlertDialogAction
            variant={spec.destructive === false ? "default" : "destructive"}
            className="h-11 text-base"
            disabled={pending}
            onClick={run}
          >
            {pending && <Loader2 className="size-5 animate-spin" aria-hidden />}
            {spec.confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
