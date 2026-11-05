import { router } from "expo-router";
import { Pressable, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { TAB } from "@/lib/links";
import { lockFix, type Lock, type LockFix } from "@/lib/locks";
import { radius, TAP, useTheme } from "@/theme";

const ACTIONS: Record<LockFix, { label: string; onPress: () => void }> = {
  role: { label: "Ask to change my roles", onPress: () => router.push("/role-request") },
  induction: { label: "Finish my induction", onPress: () => router.push("/induction") },
  training: { label: "Go to my training", onPress: () => router.navigate(TAB.training) },
  harvestPool: { label: "Join the harvest pool", onPress: () => router.push("/harvest") },
};

/** Why some shifts are locked, said once above the list rather than on every
 *  card, with the step that unlocks them. Grey, as orange is kept for shifts
 *  that need cover. */
export function LockBanner({ locks }: { locks: Lock[] }) {
  const t = useTheme();
  const action = ACTIONS[lockFix(locks)];
  return (
    <View style={{ flexDirection: "row", gap: 12, paddingTop: 16, paddingBottom: 4, paddingHorizontal: 16, borderRadius: radius.card, borderCurve: "continuous", backgroundColor: t.neutralTint }}>
      <View style={{ paddingTop: 2 }}>
        <Icon name="lock" size={18} color={t.neutral} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text variant="bodyBold" accessibilityRole="header">
          Some shifts are locked for you
        </Text>
        {locks.map((l) => (
          <Text key={l.reason} variant="small" tone="inkSoft">
            {l.reason}
          </Text>
        ))}
        <Pressable
          accessibilityRole="button"
          onPress={action.onPress}
          hitSlop={{ left: 8, right: 8 }}
          style={({ pressed }) => ({ minHeight: TAP, flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 4, opacity: pressed ? 0.6 : 1 })}
        >
          <Text variant="smallBold" tone="tealText">
            {action.label}
          </Text>
          <Icon name="chevronRight" size={13} color={t.tealText} />
        </Pressable>
      </View>
    </View>
  );
}
