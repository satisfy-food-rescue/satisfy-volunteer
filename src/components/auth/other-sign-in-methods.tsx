"use client";

import { AppleButton } from "./apple-button";
import { GoogleButton } from "./google-button";
import { PasskeySignInButton, usePasskeySupport } from "./passkey-sign-in-button";

/** Google, Apple and passkeys under an "or", or nothing when none is
 *  available, so the divider never sits over an empty space. */
export function OtherSignInMethods({ google, apple, next }: { google: boolean; apple: boolean; next: string | null }) {
  const passkeys = usePasskeySupport();
  if (!google && !apple && !passkeys) return null;
  return (
    <>
      <div className="flex items-center gap-3 text-sm text-muted-foreground" aria-hidden>
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="flex flex-col gap-3">
        {google && <GoogleButton next={next} />}
        {apple && <AppleButton next={next} />}
        {passkeys && <PasskeySignInButton next={next} />}
      </div>
    </>
  );
}
