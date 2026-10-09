"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/volunteer-actions";
import { cn } from "@/lib/utils";

/** Generic mutation button: runs a server action, toasts the result, refreshes. */
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
  confirm?: string;
  disabled?: boolean;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={disabled || pending}
      className={cn(className)}
      onClick={() => {
        if (confirm && !window.confirm(confirm)) return;
        start(async () => {
          const result = await action();
          if (result.ok) {
            toast.success(result.message ?? "Done");
            if (redirectTo) router.push(redirectTo);
            router.refresh();
          } else {
            toast.error(result.error);
          }
        });
      }}
    >
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </Button>
  );
}
