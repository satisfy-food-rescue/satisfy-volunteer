import { router } from "expo-router";
import { Pressable, View } from "react-native";

import type { BookedSession } from "@satisfy/core/api";
import { TAB } from "@/lib/links";
import { radius, useTheme } from "@/theme";

import { Chip } from "./ui/chip";
import { Icon } from "./ui/icon";
import { Text } from "./ui/text";

/** A training session the volunteer is booked into, on their week beside
 *  their shifts. Teal, the colour of training. Opens the Training tab. */
export function BookedSessionCard({ session, past }: { session: BookedSession; past?: boolean }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Training: ${session.moduleName}, ${session.timeLabel}, ${session.location}`}
      accessibilityHint="Opens your training"
      onPress={() => router.navigate(TAB.training)}
      style={({ pressed }) => ({
        flexDirection: "row",
        gap: 12,
        padding: 16,
        borderRadius: radius.card,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: t.tealText,
        backgroundColor: pressed ? t.tealTintSoft : t.card,
        opacity: past ? 0.75 : 1,
      })}
    >
      <View style={{ width: 44, alignSelf: "stretch", minHeight: 44, borderRadius: radius.lg, borderCurve: "continuous", alignItems: "center", justifyContent: "center", backgroundColor: t.tealTint }}>
        <Icon name="training" size={22} color={t.tealDeep} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text variant="eyebrow" tone="tealText">
          Training
        </Text>
        <Text variant="bodyBold">{session.moduleName}</Text>
        <Text variant="small" tone="mutedText" tabular>
          {session.timeLabel}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Icon name="pin" size={14} color={t.mutedText} />
          <Text variant="small" tone="mutedText" style={{ flexShrink: 1 }}>
            {session.location}
          </Text>
        </View>
        <View style={{ flexDirection: "row", marginTop: 2 }}>
          <Chip tone={past ? "neutral" : "info"} icon={past ? undefined : "checkCircle"} small label={past ? "You were booked in" : "You're booked in"} />
        </View>
      </View>
    </Pressable>
  );
}

/** The training sessions a volunteer has booked, as one card on Home. */
export function BookedSessionsCard({ sessions }: { sessions: BookedSession[] }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="Opens your training"
      onPress={() => router.navigate(TAB.training)}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 16,
        borderRadius: radius.card,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: t.tealText,
        backgroundColor: pressed ? t.tealTintSoft : t.card,
      })}
    >
      <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: t.tealTint }}>
        <Icon name="training" size={20} color={t.tealDeep} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyBold">{sessions.length === 1 ? "Training session booked" : `${sessions.length} training sessions booked`}</Text>
        {sessions.map((s) => (
          <Text key={s.id} variant="small" tone="mutedText">
            <Text variant="smallSemibold" tone="inkSoft">
              {s.moduleName}
            </Text>
            , {s.startLabel}
          </Text>
        ))}
      </View>
      <Icon name="arrowRight" size={18} color={t.tealText} />
    </Pressable>
  );
}
