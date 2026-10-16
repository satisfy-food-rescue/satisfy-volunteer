import { isRunningInExpoGo } from "expo";
import * as Device from "expo-device";
import * as WebBrowser from "expo-web-browser";

import type {
  GoogleSignInError,
  GoogleSignInInput,
  MutationOk,
  PasskeyOptions,
  PasskeyRegisterInput,
  PasskeySignInInput,
  PasswordSignInInput,
  SignInResult,
} from "@satisfy/core/api";

import { api, ApiError } from "./api";
import { API_URL } from "./config";
import { createPkce } from "./pkce";

// The three ways to sign in, each ending in the server's SignInResult. The
// rules (who may sign in, rate limits) are the server's; see
// src/lib/sign-in.ts at the repo root.

/** The address the website hands Google sign-ins back to. Must match the
 *  scheme in app.config.ts and APP_RETURN_URL in src/lib/mobile-auth.ts. */
const RETURN_URL = "satisfy://auth";

/** Thrown when the volunteer backed out. Not worth an error message. */
export class Cancelled extends Error {
  constructor() {
    super("Cancelled");
    this.name = "Cancelled";
  }
}

export function signInWithPassword(input: PasswordSignInInput): Promise<SignInResult> {
  return api<SignInResult>("/auth/password", { method: "POST", body: input });
}

const GOOGLE_ERRORS: Record<GoogleSignInError, (email: string | null) => string> = {
  google_cancelled: () => "Google sign-in was cancelled.",
  google_failed: () => "Google sign-in did not work just now. Please try again, or use your email and password.",
  google_unavailable: () => "Google sign-in is not available. Use your email and password instead.",
  google_unverified: () => "Google has not verified that email address, so we cannot use it to sign you in. Use your email and password instead.",
  google_unknown: (email) =>
    `We could not find a volunteer account for ${email ?? "that Google account"}. Try the email address you gave Satisfy, or contact the volunteer coordinator.`,
  inactive: () => "This account is no longer active. Contact the volunteer coordinator if that is a mistake.",
};

/** Google sign-in in the system browser (an in-app auth session), handed
 *  back to the app with a one-time code that only this app's verifier can
 *  redeem. */
export async function signInWithGoogle(): Promise<SignInResult> {
  const { verifier, challenge } = await createPkce();
  const result = await WebBrowser.openAuthSessionAsync(`${API_URL}/auth/google?app=${challenge}`, RETURN_URL);
  if (result.type !== "success") throw new Cancelled();
  const params = new URL(result.url).searchParams;
  const error = params.get("error") as GoogleSignInError | null;
  if (error === "google_cancelled") throw new Cancelled();
  if (error) throw new ApiError((GOOGLE_ERRORS[error] ?? GOOGLE_ERRORS.google_failed)(params.get("email")), 403);
  const code = params.get("code");
  if (!code) throw new ApiError(GOOGLE_ERRORS.google_failed(null), 403);
  const body: GoogleSignInInput = { code, verifier };
  return api<SignInResult>("/auth/google", { method: "POST", body });
}

type PasskeysModule = typeof import("react-native-passkeys");
type RequestOptions = Parameters<PasskeysModule["get"]>[0];
type CreationOptions = Parameters<PasskeysModule["create"]>[0];

// A native module, so it is missing from Expo Go: loaded lazily, and only in
// a development or release build, so Expo Go keeps working without passkeys.
let loaded: PasskeysModule | null | undefined;

function passkeys(): PasskeysModule | null {
  if (loaded === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- deliberately lazy, see above
      loaded = isRunningInExpoGo() ? null : (require("react-native-passkeys") as PasskeysModule);
    } catch {
      loaded = null;
    }
  }
  return loaded;
}

export function passkeysSupported(): boolean {
  try {
    return passkeys()?.isSupported() ?? false;
  } catch {
    return false;
  }
}

function requirePasskeys(): PasskeysModule {
  const module = passkeys();
  if (!module) throw new ApiError("Passkeys need the Satisfy app from the App Store or Google Play.", 0);
  return module;
}

/** The device's passkey prompt. Backing out of it is a Cancelled, anything
 *  else a message the volunteer can act on. */
async function devicePrompt<T>(prompt: () => Promise<T | null>): Promise<T> {
  let response: T | null;
  try {
    response = await prompt();
  } catch (e) {
    const name = e instanceof Error ? e.name : "";
    if (name === "NotAllowedError" || name === "AbortError" || /cancel/i.test(e instanceof Error ? e.message : "")) throw new Cancelled();
    throw new ApiError("Your phone could not use a passkey just now. Try again, or sign in another way.", 0);
  }
  if (!response) throw new Cancelled();
  return response;
}

/** Usernameless: the phone offers whichever Satisfy passkey it holds. */
export async function signInWithPasskey(): Promise<SignInResult> {
  const device = requirePasskeys();
  const { challengeId, options } = await api<PasskeyOptions<RequestOptions>>("/auth/passkey/options", { method: "POST", body: {} });
  const response = await devicePrompt(() => device.get(options));
  const body: PasskeySignInInput<typeof response> = { challengeId, response };
  return api<SignInResult>("/auth/passkey", { method: "POST", body });
}

/** Creates a passkey on this phone for the signed-in volunteer. */
export async function addPasskey(): Promise<MutationOk> {
  const device = requirePasskeys();
  const { challengeId, options } = await api<PasskeyOptions<CreationOptions>>("/passkeys/options", { method: "POST", body: {} });
  const response = await devicePrompt(() => device.create(options));
  const body: PasskeyRegisterInput<typeof response> = { challengeId, response, name: Device.deviceName || Device.modelName || "This phone" };
  return api<MutationOk>("/passkeys", { method: "POST", body });
}
