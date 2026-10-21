"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { Loader2, LogIn } from "lucide-react";
import { signInWithPassword, type SignInState } from "@/app/sign-in/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormNotice } from "./form-notice";
import { PasswordInput } from "./password-input";

export function SignInForm({ next, initialEmail }: { next: string | null; initialEmail?: string }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(signInWithPassword, { email: initialEmail });
  const forgotHref = `/forgot-password${state.email ? `?email=${encodeURIComponent(state.email)}` : ""}`;
  const passwordRef = useRef<HTMLInputElement>(null);
  // The pending button is disabled while the form submits, which drops focus.
  // Put it back on the password, the field to retype after a refusal.
  useEffect(() => {
    if (state.error) passwordRef.current?.focus();
  }, [state]);
  const describedBy = state.error ? "sign-in-error" : undefined;
  const invalid = state.invalid || undefined;
  return (
    <form action={action} className="flex flex-col gap-4">
      {next && <input type="hidden" name="next" value={next} />}
      {state.error && <FormNotice id="sign-in-error" tone="error">{state.error}</FormNotice>}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email" className="text-base">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="username webauthn" inputMode="email" required defaultValue={state.email} className="h-12 text-base" aria-invalid={invalid} aria-describedby={describedBy} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password" className="text-base">Password</Label>
        <PasswordInput ref={passwordRef} id="password" name="password" autoComplete="current-password" required aria-invalid={invalid} aria-describedby={describedBy} />
        <Link href={forgotHref} className="-mt-1.5 -mb-2 inline-flex min-h-11 items-center self-end font-semibold text-teal underline-offset-4 hover:underline">Forgot your password?</Link>
      </div>
      <Button type="submit" size="lg" className="h-12 text-base" disabled={pending}>
        {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <LogIn className="size-5" aria-hidden />}
        Sign in
      </Button>
    </form>
  );
}
