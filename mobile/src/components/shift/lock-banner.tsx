import { router } from "expo-router";
import { Pressable, View } from "react-native";

import type { ShiftAction, ShiftSummary } from "@satisfy/core/api";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { TAB } from "@/lib/links";
import { radius, TAP, useTheme } from "@/theme";

export type Lock = Extract<ShiftAction, { kind: "BLOCKED" }>;

/** The locks on these shifts, one per reason, in the order they first
 *  appear. */
export function locksOf(shifts: ShiftSummary[]): Lock[] {
  const byReason = new Map<string, Lock>();
  for (const s of shifts) if (s.action.kind === "BLOCKED" && !byReason.has(s.action.reason)) byReason.set(s.action.reason, s.action);
  return [...byReason.values()];
}

/** When locked shifts open up, in the web's words for each case. */
export function unlockNote(locks: Lock[]): string {
  const role = locks.some((l) => l.fix !== "training");
  const training = locks.some((l) => l.fix === "training");
  return role && training
    ? "Locked shifts open up once you have the role and the training they need."
    : role
      ? "Locked shifts open up once you have the role they need."
      : "Locked shifts open up as soon as the training they need is current.";
}

/** Why some shifts are locked, said once above the list rather than on every
 *  card, with the step that unlocks them. Grey, as orange is kept for shifts
 *  that need cover. */
export function LockBanner({ locks }: { locks: Lock[] }) {
  const t = useTheme();
  // A missing role is the coordinator's to fix, so it comes first, as on the
  // web.
  const action = locks.some((l) => l.fix === "role")
    ? { label: "Ask to change my roles", onPress: () => router.push("/role-request") }
    : locks.some((l) => l.fix === "training")
      ? { label: "Go to my training", onPress: () => router.navigate(TAB.training) }
      : { label: "Join the harvest pool", onPress: () => router.push("/harvest") };
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
