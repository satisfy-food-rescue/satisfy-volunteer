import { Stack } from "expo-router";

import { DOCUMENTS_TITLE } from "@satisfy/core/domain";

import { font, useTheme } from "@/theme";

// One stack per tab, sharing the detail screens so a shift opened from Cover
// stays in the Cover tab.
const ROOTS = {
  home: { name: "index", title: "Home" },
  shifts: { name: "shifts", title: "Shifts" },
  cover: { name: "cover", title: "Cover" },
  training: { name: "training", title: "Training" },
  me: { name: "me", title: "Me" },
} as const;

type Tab = keyof typeof ROOTS;

// A screen opened straight from a link (a notification, say) gets its tab's
// root underneath it, so there is always a way back. Keyed by group, as the
// stack is shared: the top-level anchor is Home's.
export const unstable_settings = {
  anchor: ROOTS.home.name,
  shifts: { anchor: ROOTS.shifts.name },
  cover: { anchor: ROOTS.cover.name },
  training: { anchor: ROOTS.training.name },
  me: { anchor: ROOTS.me.name },
};

export default function TabStackLayout({ segment }: { segment: string }) {
  const t = useTheme();
  const tab = segment.replace(/[()]/g, "") as Tab;
  const root = ROOTS[tab] ?? ROOTS.home;
  return (
    <Stack
      screenOptions={({ route }) => ({
        // Another tab's root opened by a link inside this stack keeps its own
        // title rather than its route name.
        title: Object.values(ROOTS).find((r) => r.name === route.name)?.title,
        headerTintColor: t.tealText,
        headerTitleStyle: { fontFamily: font.bold, color: t.ink },
        headerLargeTitleStyle: { fontFamily: font.bold, color: t.ink },
        headerShadowVisible: false,
        headerLargeTitleShadowVisible: false,
        // Transparent, not the page colour: on iOS 26 an opaque large-title
        // bar hides the large title itself, leaving an empty band.
        headerLargeStyle: { backgroundColor: "transparent" },
        // On iOS the bar stays clear so content scrolling under it gets the
        // system's soft blur, as Home's status bar does. Every screen here
        // scrolls with automatic insets, so nothing starts hidden under it.
        headerTransparent: process.env.EXPO_OS === "ios",
        headerStyle: process.env.EXPO_OS === "ios" ? undefined : { backgroundColor: t.background },
        headerBackButtonDisplayMode: "minimal",
        contentStyle: { backgroundColor: t.background },
      })}
    >
      <Stack.Screen name={root.name} options={{ title: root.title, headerLargeTitleEnabled: true, headerShown: tab !== "home" }} />
      <Stack.Screen name="shift/[id]" options={{ title: "" }} />
      <Stack.Screen name="module/[code]" options={{ title: "" }} />
      <Stack.Screen name="slot" options={{ title: "My regular slot" }} />
      <Stack.Screen name="harvest" options={{ title: "Harvest" }} />
      <Stack.Screen name="induction" options={{ title: "Your induction" }} />
      <Stack.Screen name="policies/index" options={{ title: DOCUMENTS_TITLE }} />
      <Stack.Screen name="policies/[id]" options={{ title: "" }} />
    </Stack>
  );
}
