"use client";

import { useActionState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { setPasswordWithToken, type SetPasswordState } from "@/app/reset-password/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PASSWORD_MIN } from "@/lib/auth-shared";
import { FormNotice } from "./form-notice";
import { PasswordInput } from "./password-input";

export function SetPasswordForm({ token, email, submitLabel }: { token: string; email: string; submitLabel: string }) {
  const [state, action, pending] = useActionState<SetPasswordState, FormData>(setPasswordWithToken, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      {/* Lets password managers save the new password against the right account. */}
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      {state.error && <FormNotice tone="error">{state.error}</FormNotice>}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password" className="text-base">New password</Label>
        <PasswordInput id="password" name="password" autoComplete="new-password" required minLength={PASSWORD_MIN} aria-invalid={Boolean(fe.password) || undefined} aria-describedby="password-help" />
        <p id="password-help" className={fe.password ? "text-sm text-status-bad" : "text-sm text-muted-foreground"}>
          {fe.password ?? `At least ${PASSWORD_MIN} characters. A short phrase you will remember works well.`}
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirm" className="text-base">Type it again</Label>
        <PasswordInput id="confirm" name="confirm" autoComplete="new-password" required aria-invalid={Boolean(fe.confirm) || undefined} aria-describedby={fe.confirm ? "confirm-error" : undefined} />
        {fe.confirm && <p id="confirm-error" className="text-sm text-status-bad">{fe.confirm}</p>}
      </div>
      <Button type="submit" size="lg" className="h-12 text-base" disabled={pending}>
        {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <KeyRound className="size-5" aria-hidden />}
        {submitLabel}
      </Button>
    </form>
  );
}
