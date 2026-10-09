import { router, Stack } from "expo-router";
import { Pressable } from "react-native";

import { Icon } from "@/components/ui/icon";
import { TAB } from "@/lib/links";
import { font, useTheme } from "@/theme";

// One stack per tab, sharing the detail screens so a shift opened from Cover
// stays in the Cover tab. Each tab's root screen must be declared first: the
// first screen in a stack is its initial route.
const ROOTS = {
  home: { name: "index", title: "Home", href: TAB.home },
  shifts: { name: "shifts", title: "Shifts", href: TAB.shifts },
  cover: { name: "cover", title: "Cover", href: TAB.cover },
  training: { name: "training", title: "Training", href: TAB.training },
  me: { name: "me", title: "Me", href: TAB.me },
} as const;

type Tab = keyof typeof ROOTS;

export default function TabStackLayout({ segment }: { segment: string }) {
  const t = useTheme();
  const tab = segment.replace(/[()]/g, "") as Tab;
  const root = ROOTS[tab] ?? ROOTS.home;
  return (
    <Stack
      screenOptions={({ navigation, route }) => ({
        // A screen opened straight from a link has nothing underneath it;
        // give it a way back to its tab rather than a dead end.
        headerLeft:
          route.name === root.name || navigation.canGoBack()
            ? undefined
            : () => (
                <Pressable accessibilityRole="button" accessibilityLabel={`Back to ${root.title}`} hitSlop={12} onPress={() => router.replace(root.href)}>
                  <Icon name="chevronLeft" size={22} color={t.tealText} />
                </Pressable>
              ),
        headerTintColor: t.tealText,
        headerTitleStyle: { fontFamily: font.bold, color: t.ink },
        headerLargeTitleStyle: { fontFamily: font.bold, color: t.ink },
        headerShadowVisible: false,
        headerLargeTitleShadowVisible: false,
        // Transparent, not the page colour: on iOS 26 an opaque large-title
        // bar hides the large title itself, leaving an empty band.
        headerLargeStyle: { backgroundColor: "transparent" },
        headerStyle: { backgroundColor: t.background },
        headerBackButtonDisplayMode: "minimal",
        contentStyle: { backgroundColor: t.background },
      })}
    >
      <Stack.Screen name={root.name} options={{ title: root.title, headerLargeTitleEnabled: true, headerShown: tab !== "home" }} />
      <Stack.Screen name="shift/[id]" options={{ title: "" }} />
      <Stack.Screen name="module/[code]" options={{ title: "" }} />
      <Stack.Screen name="slot" options={{ title: "My regular slot" }} />
      <Stack.Screen name="harvest" options={{ title: "Harvest pool" }} />
    </Stack>
  );
}
