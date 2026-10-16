"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/volunteer-actions";
import { cn } from "@/lib/utils";

/** An on/off button that runs a server action, such as marking attendance.
 *  `pressed` is announced to screen readers, so the state is never carried
 *  by the button's colour alone. */
export function ToggleActionButton({
  pressed,
  action,
  children,
  className,
  pressedVariant = "default",
}: {
  pressed: boolean;
  action: () => Promise<ActionResult>;
  children: React.ReactNode;
  className?: string;
  pressedVariant?: "default" | "destructive";
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = () =>
    start(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(result.message ?? "Done");
        router.refresh();
      } else toast.error(result.error);
    });
  return (
    <Button
      type="button"
      size="sm"
      variant={pressed ? pressedVariant : "outline"}
      aria-pressed={pressed}
      disabled={pending}
      className={cn(pending && "[&>svg:not([data-spinner])]:hidden", className)}
      onClick={run}
    >
      {pending && <Loader2 data-spinner className="size-4 animate-spin" aria-hidden />}
      {children}
    </Button>
  );
}
