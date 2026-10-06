"use client";

import { useActionState } from "react";
import { Loader2, Send } from "lucide-react";
import { requestSignInLink, type LinkState } from "@/app/sign-in/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormNotice } from "./form-notice";

export function LinkRequestForm({ initialEmail }: { initialEmail?: string }) {
  const [state, action, pending] = useActionState<LinkState, FormData>(requestSignInLink, { email: initialEmail });
  if (state.sent) {
    return (
      <FormNotice tone="success">
        <p className="font-semibold">Check your email</p>
        <p className="mt-1">
          If {state.email} belongs to a Satisfy volunteer, a link to choose a password is on its way. It works once and for 2 hours. Check your spam folder if it has not arrived in a few minutes.
        </p>
      </FormNotice>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error && <FormNotice tone="error">{state.error}</FormNotice>}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email" className="text-base">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required defaultValue={state.email} className="h-12 text-base" />
      </div>
      <Button type="submit" size="lg" className="h-12 text-base" disabled={pending}>
        {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Send className="size-5" aria-hidden />}
        Email me a link
      </Button>
    </form>
  );
}
