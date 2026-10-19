// The words for a sign-in with Google or Apple that did not work, shared so
// the website (/sign-in), the server (the iOS app's native Apple sign-in) and
// the native app say the same thing. The rules are the server's
// (src/lib/sign-in.ts at the repo root).

import type { AppleSignInError, GoogleSignInError } from "./api";

export type ProviderSignInError = GoogleSignInError | AppleSignInError;

const MESSAGES: Record<ProviderSignInError, (email: string | null) => string> = {
  google_cancelled: () => "Google sign-in was cancelled.",
  google_failed: () => "Google sign-in did not work just now. Please try again, or use your email and password.",
  google_unavailable: () => "Google sign-in is not available. Use your email and password instead.",
  google_unverified: () => "Google has not verified that email address, so we cannot use it to sign you in. Use your email and password instead.",
  google_unknown: (email) =>
    `We could not find a volunteer account for ${email ?? "that Google account"}. Try the email address you gave Satisfy, or contact the volunteer coordinator.`,
  apple_cancelled: () => "Apple sign-in was cancelled.",
  apple_failed: () => "Apple sign-in did not work just now. Please try again, or use your email and password.",
  apple_unavailable: () => "Apple sign-in is not available. Use your email and password instead.",
  apple_unknown: (email) =>
    `We could not find a volunteer account for ${email ?? "that Apple Account"}. Try the email address you gave Satisfy, or contact the volunteer coordinator.`,
  apple_private: () =>
    "You chose to hide your email from Satisfy, so we cannot tell which volunteer you are. Sign in another way, then connect Apple in Sign-in and security. After that, Apple sign-in works on its own.",
  inactive: () => "This account is no longer active. Contact the volunteer coordinator if that is a mistake.",
};

export function isProviderSignInError(reason: string | null | undefined): reason is ProviderSignInError {
  return Boolean(reason && Object.hasOwn(MESSAGES, reason));
}

/** The message for a refused or failed sign-in. `email` is the address the
 *  provider gave, when there was one to name. */
export function providerSignInMessage(reason: ProviderSignInError, email: string | null = null): string {
  return MESSAGES[reason](email);
}

export type ProviderConnectError = "google_taken" | "google_exists" | "apple_taken" | "apple_exists";

const CONNECT_MESSAGES: Record<ProviderConnectError, string> = {
  google_taken: "That Google account is already connected to someone else's volunteer account.",
  google_exists: "A Google account is already connected. Disconnect it first to connect a different one.",
  apple_taken: "That Apple Account is already connected to someone else's volunteer account.",
  apple_exists: "An Apple Account is already connected. Disconnect it first to connect a different one.",
};

export function isProviderConnectError(reason: string | null | undefined): reason is ProviderConnectError {
  return Boolean(reason && Object.hasOwn(CONNECT_MESSAGES, reason));
}

/** Why "Connect Google" or "Connect Apple" in Sign-in and security did not
 *  connect. */
export function providerConnectMessage(reason: ProviderConnectError): string {
  return CONNECT_MESSAGES[reason];
}
