import { isRunningInExpoGo } from "expo";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as SecureStore from "expo-secure-store";

import type { MutationOk, PushData, PushTokenInput } from "@satisfy/core/api";

import { api } from "./api";

type NotificationsModule = typeof import("expo-notifications");
type PermissionStatus = import("expo-notifications").PermissionStatus;

const PUSH_TOKEN_KEY = "satisfy.push-token";

// Expo Go on Android has no remote push since SDK 53 and throws as soon as
// expo-notifications is imported, so the module is only loaded where push
// can work: development and release builds, and Expo Go on iOS.
const pushUnsupported = process.env.EXPO_OS === "android" && isRunningInExpoGo();
let loaded: NotificationsModule | null | undefined;

function notifications(): NotificationsModule | null {
  if (loaded === undefined) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- deliberately lazy, see above
    loaded = pushUnsupported ? null : (require("expo-notifications") as NotificationsModule);
    // Show cover requests even while the app is open: they are time-sensitive.
    loaded?.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
    });
  }
  return loaded;
}

function projectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

export type PushAvailability = "available" | "simulator" | "unlinked" | "expoGo";

/** Push needs a real device and an EAS-linked build (or Expo Go on iOS). */
export function pushAvailability(): PushAvailability {
  if (pushUnsupported) return "expoGo";
  if (!Device.isDevice) return "simulator";
  if (!projectId()) return "unlinked";
  return "available";
}

export async function pushPermission(): Promise<PermissionStatus | null> {
  const N = notifications();
  return N ? (await N.getPermissionsAsync()).status : null;
}

/** Asks for permission (iOS shows its prompt once), then registers this
 *  device's Expo push token with the server. Safe to call on every launch. */
export async function registerForPush({ ask }: { ask: boolean }): Promise<PermissionStatus | null> {
  const N = notifications();
  if (!N || pushAvailability() !== "available") return null;
  if (process.env.EXPO_OS === "android") {
    await N.setNotificationChannelAsync("default", {
      name: "Shift cover",
      importance: N.AndroidImportance.HIGH,
      lightColor: "#106379",
    });
  }
  let { status, canAskAgain } = await N.getPermissionsAsync();
  if (status !== "granted" && ask && canAskAgain) ({ status } = await N.requestPermissionsAsync());
  if (status !== "granted") return status;
  const { data: token } = await N.getExpoPushTokenAsync({ projectId: projectId() });
  const body: PushTokenInput = { token, platform: process.env.EXPO_OS === "ios" ? "ios" : "android", deviceName: Device.deviceName ?? undefined };
  await api<MutationOk>("/push-tokens", { method: "POST", body });
  await SecureStore.setItemAsync(PUSH_TOKEN_KEY, token);
  return status;
}

/** Calls `open` with the web path a tapped notification points at, including
 *  the one that launched the app. Returns an unsubscribe function. */
export function onNotificationOpened(open: (url: string | undefined) => void): () => void {
  const N = notifications();
  if (!N) return () => {};
  const handle = (response: import("expo-notifications").NotificationResponse | null) => {
    if (!response || response.actionIdentifier !== N.DEFAULT_ACTION_IDENTIFIER) return;
    open((response.notification.request.content.data as Partial<PushData> | undefined)?.url);
    N.clearLastNotificationResponse();
  };
  handle(N.getLastNotificationResponse());
  const subscription = N.addNotificationResponseReceivedListener(handle);
  return () => subscription.remove();
}

/** The token this device registered, so sign-out can forget it. */
export function storedPushToken(): Promise<string | null> {
  return SecureStore.getItemAsync(PUSH_TOKEN_KEY);
}

export function forgetPushToken(): Promise<void> {
  return SecureStore.deleteItemAsync(PUSH_TOKEN_KEY);
}
