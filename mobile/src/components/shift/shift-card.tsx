import { router } from "expo-router";
import { Pressable, View } from "react-native";

import type { ShiftSummary } from "@satisfy/core/api";
import { formatTimeRange } from "@satisfy/core/dates";
import { Chip } from "@/components/ui/chip";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { radius, useTheme } from "@/theme";

import { CrewLine } from "./crew-line";
import { KindTile } from "./kind-tile";

/** A shift in a list: what, when, my status and who else is on. */
export function ShiftCard({ shift }: { shift: ShiftSummary }) {
  const t = useTheme();
  const a = shift.action;
  const mine = a.kind === "MINE";
  const blocked = a.kind === "BLOCKED";
  const cancelled = a.kind === "CANCELLED";
  return (
    <Pressable onPress={() => router.push({ pathname: "/shift/[id]", params: { id: shift.id } })}
        accessibilityRole="button"
        accessibilityLabel={`${shift.name}, ${formatTimeRange(shift.startTime, shift.endTime)}`}
        style={({ pressed }) => ({
          flexDirection: "row",
          gap: 12,
          padding: 14,
          borderRadius: radius.card,
          borderCurve: "continuous",
          borderWidth: 1,
          borderColor: mine ? t.green75 : shift.isGap ? t.orange : t.border,
          backgroundColor: pressed ? t.cardSunk : t.card,
        })}
      >
        <KindTile kind={shift.kind} />
        <View style={{ flex: 1, gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Text variant="bodyBold" numberOfLines={2}>
                {shift.name}
              </Text>
              <Text variant="small" tone="mutedText" tabular>
                {formatTimeRange(shift.startTime, shift.endTime)}
              </Text>
            </View>
            <Icon name="chevronRight" size={16} color={t.mutedText} />
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
            {cancelled ? (
              <Chip tone="neutral" icon="cancelled" small label="Cancelled" />
            ) : mine ? (
              <Chip tone="good" icon="checkCircle" small label={a.source === "REGULAR" ? "Your regular slot" : a.source === "COVER" ? "You're covering" : "You're on"} />
            ) : shift.isGap ? (
              <Chip tone="bad" icon="cover" small label="Needs cover" />
            ) : shift.isFull ? (
              <Chip tone="neutral" small label="Full" />
            ) : null}
            {blocked && <Chip tone="warn" icon="lock" small label="Training needed" />}
            <View style={{ marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Icon name="people" size={14} color={t.mutedText} />
              <Text variant="small" tone="mutedText" tabular accessibilityLabel={`${shift.confirmedCount} of ${shift.capacity} places filled`}>
                {shift.confirmedCount}/{shift.capacity}
              </Text>
            </View>
          </View>
          <CrewLine crew={shift.crew} />
          {blocked && (
            <Text variant="small" tone="orangeText">
              {a.reason}
            </Text>
          )}
        </View>
      </Pressable>
  );
}
