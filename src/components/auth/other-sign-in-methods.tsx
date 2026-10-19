"use client";

import { GoogleButton } from "./google-button";
import { PasskeySignInButton, usePasskeySupport } from "./passkey-sign-in-button";

/** Google and passkeys under an "or", or nothing when neither is available,
 *  so the divider never sits over an empty space. */
export function OtherSignInMethods({ google, next }: { google: boolean; next: string | null }) {
  const passkeys = usePasskeySupport();
  if (!google && !passkeys) return null;
  return (
    <>
      <div className="flex items-center gap-3 text-sm text-muted-foreground" aria-hidden>
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="flex flex-col gap-3">
        {google && <GoogleButton next={next} />}
        {passkeys && <PasskeySignInButton next={next} />}
      </div>
    </>
  );
}
