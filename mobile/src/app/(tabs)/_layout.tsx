import { NativeTabs } from "expo-router/unstable-native-tabs";

import { useSession } from "@/lib/queries";
import { useTheme } from "@/theme";

function badge(n: number | undefined) {
  return n ? String(n) : undefined;
}

export default function TabsLayout() {
  const t = useTheme();
  const { data } = useSession();
  return (
    <NativeTabs
      tintColor={t.tealText}
      iconColor={{ default: t.mutedText, selected: t.tealText }}
      labelStyle={{ default: { color: t.mutedText }, selected: { color: t.tealText } }}
      badgeBackgroundColor={t.orange}
      badgeTextColor={t.onOrange}
      backgroundColor={process.env.EXPO_OS === "android" ? t.card : undefined}
      indicatorColor={t.tealTint}
      labelVisibilityMode="labeled"
    >
      <NativeTabs.Trigger name="(home)">
        <NativeTabs.Trigger.Icon sf={{ default: "house", selected: "house.fill" }} md="home" />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(shifts)">
        <NativeTabs.Trigger.Icon sf="calendar" md="calendar_month" />
        <NativeTabs.Trigger.Label>Shifts</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(cover)">
        <NativeTabs.Trigger.Icon sf={{ default: "hand.raised", selected: "hand.raised.fill" }} md="volunteer_activism" />
        <NativeTabs.Trigger.Label>Cover</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Badge hidden={!data?.badges.cover}>{badge(data?.badges.cover)}</NativeTabs.Trigger.Badge>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(training)">
        <NativeTabs.Trigger.Icon sf={{ default: "graduationcap", selected: "graduationcap.fill" }} md="school" />
        <NativeTabs.Trigger.Label>Training</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Badge hidden={!data?.badges.training}>{badge(data?.badges.training)}</NativeTabs.Trigger.Badge>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(me)">
        <NativeTabs.Trigger.Icon sf={{ default: "person.crop.circle", selected: "person.crop.circle.fill" }} md="account_circle" />
        <NativeTabs.Trigger.Label>Me</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
