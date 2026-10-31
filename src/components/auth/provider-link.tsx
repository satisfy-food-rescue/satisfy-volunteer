"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** A link to Google's or Apple's sign-in, to sign in or to connect it. A plain
 *  link, since the round trip is a full-page navigation, that shows a spinner
 *  in place of the mark until the provider's page loads, as the passkey button
 *  does, and ignores a second click meanwhile. */
export function ProviderLink({ href, mark, children }: { href: string; mark: ReactNode; children: ReactNode }) {
  const [pending, setPending] = useState(false);

  // Coming back from the provider with the browser's Back button can restore
  // this page exactly as it was left, spinner and all.
  useEffect(() => {
    const reset = (event: PageTransitionEvent) => {
      if (event.persisted) setPending(false);
    };
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  return (
    <a
      href={href}
      aria-disabled={pending || undefined}
      className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-12 text-base", pending && "pointer-events-none opacity-50")}
      onClick={(event) => {
        if (pending) return event.preventDefault();
        // Opening it in a new tab or window leaves this page as it is.
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        setPending(true);
      }}
    >
      {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : mark}
      {children}
    </a>
  );
}
