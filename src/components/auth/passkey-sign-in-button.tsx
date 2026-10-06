"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { browserSupportsWebAuthn, startAuthentication, WebAuthnError } from "@simplewebauthn/browser";
import { Fingerprint, Loader2 } from "lucide-react";
import { beginPasskeySignIn, finishPasskeySignIn } from "@/app/sign-in/passkey-actions";
import { Button } from "@/components/ui/button";
import { FormNotice } from "./form-notice";

const noop = () => () => {};

export function PasskeySignInButton({ next }: { next: string | null }) {
  const supported = useSyncExternalStore(noop, browserSupportsWebAuthn, () => false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!supported) return null;

  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="h-12 text-base"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const begin = await beginPasskeySignIn();
            if (!begin.ok) return setError(begin.error);
            let response;
            try {
              response = await startAuthentication({ optionsJSON: begin.options });
            } catch (err) {
              // Cancelling the device prompt is not an error worth shouting about.
              if (err instanceof WebAuthnError && err.code === "ERROR_CEREMONY_ABORTED") return;
              if (err instanceof Error && err.name === "NotAllowedError") return;
              return setError("Your device could not use a passkey just now. Try again or sign in with your email.");
            }
            const finish = await finishPasskeySignIn(response, next);
            if (!finish.ok) return setError(finish.error);
            // A full load so every server component sees the new session.
            window.location.assign(finish.redirectTo);
          })
        }
      >
        {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Fingerprint className="size-5" aria-hidden />}
        Sign in with a passkey
      </Button>
      {error && <FormNotice tone="error">{error}</FormNotice>}
    </div>
  );
}
