import { isRunningInExpoGo } from "expo";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Device from "expo-device";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";

import type {
  AppleConnectInput,
  AppleSignInInput,
  GoogleSignInInput,
  MutationOk,
  PasskeyOptions,
  PasskeyRegisterInput,
  PasskeySignInInput,
  PasswordSignInInput,
  SignInResult,
} from "@satisfy/core/api";
import { isProviderSignInError, providerSignInMessage } from "@satisfy/core/sign-in";

import { api, ApiError } from "./api";
import { API_URL } from "./config";
import { createPkce } from "./pkce";

// The four ways to sign in, each ending in the server's SignInResult. The
// rules (who may sign in, rate limits) are the server's; see
// src/lib/sign-in.ts at the repo root.

/** The address the website hands Google and Apple sign-ins back to. Must match the
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

/** Google, or Apple on Android, in the system browser (an in-app auth
 *  session), handed back to the app with a one-time code that only this
 *  app's verifier can redeem. */
async function browserSignIn(provider: "google" | "apple"): Promise<SignInResult> {
  const { verifier, challenge } = await createPkce();
  const result = await WebBrowser.openAuthSessionAsync(`${API_URL}/auth/${provider}?app=${challenge}`, RETURN_URL);
  if (result.type !== "success") throw new Cancelled();
  const params = new URL(result.url).searchParams;
  const error = params.get("error");
  if (error === `${provider}_cancelled`) throw new Cancelled();
  const failed = providerSignInMessage(`${provider}_failed`);
  if (error) throw new ApiError(isProviderSignInError(error) ? providerSignInMessage(error, params.get("email")) : failed, 403);
  const code = params.get("code");
  if (!code) throw new ApiError(failed, 403);
  const body: GoogleSignInInput = { code, verifier };
  return api<SignInResult>(`/auth/${provider}`, { method: "POST", body });
}

export function signInWithGoogle(): Promise<SignInResult> {
  return browserSignIn("google");
}

// Apple: natively on iOS (the identity token goes to the server with the
// nonce whose hash Apple put in it), in the system browser on Android.

/** Whether this phone can sign in with Apple, given the server offers it.
 *  Not in Expo Go on iOS: Apple would vouch for Expo Go, not for Satisfy. */
export async function appleSupported(): Promise<boolean> {
  if (Platform.OS === "android") return true;
  if (Platform.OS !== "ios" || isRunningInExpoGo()) return false;
  return AppleAuthentication.isAvailableAsync().catch(() => false);
}

/** Apple's sheet on iOS. Backing out of it is a Cancelled. */
async function appleCredential(): Promise<AppleConnectInput> {
  const { verifier: nonce, challenge } = await createPkce();
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({ requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL], nonce: challenge });
  } catch (e) {
    if (e instanceof Error && "code" in e && e.code === "ERR_REQUEST_CANCELED") throw new Cancelled();
    throw new ApiError(providerSignInMessage("apple_failed"), 0);
  }
  if (!credential.identityToken) throw new ApiError(providerSignInMessage("apple_failed"), 0);
  return { identityToken: credential.identityToken, nonce };
}

export async function signInWithApple(): Promise<SignInResult> {
  if (Platform.OS !== "ios") return browserSignIn("apple");
  const body: AppleSignInInput = await appleCredential();
  return api<SignInResult>("/auth/apple", { method: "POST", body });
}

/** Connects Apple to the signed-in volunteer, on iOS. */
export async function connectApple(): Promise<MutationOk> {
  const body: AppleConnectInput = await appleCredential();
  return api<MutationOk>("/apple", { method: "POST", body });
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
