import { router } from "expo-router";
import { Pressable, View } from "react-native";

import type { ShiftSummary } from "@satisfy/core/api";
import { formatDay, formatTimeRange } from "@satisfy/core/dates";
import { isAdHocKind } from "@satisfy/core/domain";
import { Chip } from "@/components/ui/chip";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { radius, useTheme } from "@/theme";

import { CrewLine } from "./crew-line";
import { KindTile } from "./kind-tile";

/** A shift in a list: what, when, my status and who else is on. `showDate`
 *  is for lists that span days rather than sitting under a day heading. */
export function ShiftCard({ shift, showDate = false, hideReason = false }: { shift: ShiftSummary; showDate?: boolean; hideReason?: boolean }) {
  const when = `${showDate ? `${formatDay(shift.iso)}, ` : ""}${formatTimeRange(shift.startTime, shift.endTime)}`;
  const t = useTheme();
  const a = shift.action;
  const mine = a.kind === "MINE";
  const blocked = a.kind === "BLOCKED";
  const cancelled = a.kind === "CANCELLED";
  return (
    <Pressable onPress={() => router.push({ pathname: "/shift/[id]", params: { id: shift.id } })}
        accessibilityRole="button"
        accessibilityLabel={`${shift.name}, ${when}`}
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
                {when}
              </Text>
              {isAdHocKind(shift.kind) && (
                <Text variant="small" tone="mutedText" numberOfLines={1}>
                  {shift.location}
                </Text>
              )}
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
            ) : isAdHocKind(shift.kind) && a.kind === "BOOK" ? (
              <Chip tone="info" small label={`${shift.spotsLeft} ${shift.spotsLeft === 1 ? "place" : "places"} left`} />
            ) : null}
            {blocked && <Chip tone="warn" icon="lock" small label={a.fix === "harvestPool" ? "Join the pool" : a.fix === "role" ? "Role needed" : "Training needed"} />}
            <View style={{ marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Icon name="people" size={14} color={t.mutedText} />
              <Text variant="small" tone="mutedText" tabular accessibilityLabel={`${shift.confirmedCount} of ${shift.capacity} places filled`}>
                {shift.confirmedCount}/{shift.capacity}
              </Text>
            </View>
          </View>
          <CrewLine crew={shift.crew} />
          {blocked && !hideReason && (
            <Text variant="small" tone="orangeText">
              {a.reason}
            </Text>
          )}
        </View>
      </Pressable>
  );
}
