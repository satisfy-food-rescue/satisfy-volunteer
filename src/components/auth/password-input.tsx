"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Password field with a show/hide toggle, which saves a lot of retyping on a
 *  phone keyboard. */
export function PasswordInput({ className, ...props }: Omit<React.ComponentProps<"input">, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={visible ? "text" : "password"} className={cn("h-12 pr-12 text-base", className)} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-lg text-muted-foreground hover:text-ink focus-visible:outline-3 focus-visible:outline-green"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
      >
        {visible ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
      </button>
    </div>
  );
}
