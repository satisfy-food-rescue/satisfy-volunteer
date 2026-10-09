import { Montserrat_400Regular } from "@expo-google-fonts/montserrat/400Regular";
import { Montserrat_500Medium } from "@expo-google-fonts/montserrat/500Medium";
import { Montserrat_600SemiBold } from "@expo-google-fonts/montserrat/600SemiBold";
import { Montserrat_700Bold } from "@expo-google-fonts/montserrat/700Bold";
import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { useColorScheme } from "react-native";

import { ToastProvider } from "@/components/toast";
import { AuthProvider, useAuth } from "@/lib/auth";
import { routeForWebPath } from "@/lib/links";
import { onNotificationOpened } from "@/lib/push";
import { queryClient } from "@/lib/query-client";
import { font, useTheme } from "@/theme";

SplashScreen.preventAutoHideAsync();

// A deep link or notification that opens a screen on a cold start still gets
// the tabs underneath it, so there is always a way back.
export const unstable_settings = { anchor: "(tabs)" };

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Montserrat_400Regular, Montserrat_500Medium, Montserrat_600SemiBold, Montserrat_700Bold });
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <RootNavigator fontsReady={fontsLoaded || !!fontError} />
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
  const { status } = useAuth();
  const scheme = useColorScheme();
  const t = useTheme();
  const ready = fontsReady && status !== "loading";
  const signedIn = status === "signedIn";

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  useNotificationRouting(ready && signedIn);

  // Hold the splash until fonts and the stored session are known, so a
  // signed-in volunteer never sees the sign-in screen flash on launch.
  if (!ready) return null;

  const base = scheme === "dark" ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, primary: t.tealText, background: t.background, card: t.card, text: t.ink, border: t.border, notification: t.orange },
    fonts: {
      regular: { fontFamily: font.regular, fontWeight: "400" as const },
      medium: { fontFamily: font.medium, fontWeight: "500" as const },
      bold: { fontFamily: font.bold, fontWeight: "700" as const },
      heavy: { fontFamily: font.bold, fontWeight: "800" as const },
    },
  };

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="mark-away"
            options={{
              presentation: "formSheet",
              sheetGrabberVisible: true,
              sheetAllowedDetents: [0.92],
              sheetCornerRadius: 28,
              headerShown: false,
              contentStyle: { backgroundColor: t.background },
            }}
          />
          <Stack.Screen
            name="role-request"
            options={{
              presentation: "formSheet",
              sheetGrabberVisible: true,
              sheetAllowedDetents: "fitToContents",
              sheetCornerRadius: 28,
              headerShown: false,
              contentStyle: { backgroundColor: t.background },
            }}
          />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}

/** Opens the screen a push notification points at, including the one that
 *  launched the app. */
function useNotificationRouting(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    return onNotificationOpened((url) => router.push(routeForWebPath(url)));
  }, [enabled]);
}
