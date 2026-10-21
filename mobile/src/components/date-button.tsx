import { Pressable, View } from "react-native";

import { formatDay } from "@satisfy/core/dates";
import { radius, useTheme } from "@/theme";

import { Icon } from "./ui/icon";
import { Text } from "./ui/text";

/** A date in a bordered field, like the text fields, that opens a picker. */
export function DateButton({ label, value, expanded, onPress }: { label: string; value: string; expanded?: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${formatDay(value)}`}
      accessibilityHint="Opens a calendar"
      accessibilityState={expanded === undefined ? undefined : { expanded }}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 50,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 14,
        borderRadius: radius.lg,
        borderCurve: "continuous",
        borderWidth: expanded ? 2 : 1,
        borderColor: expanded ? t.primary : t.input,
        backgroundColor: pressed ? t.cardSunk : t.card,
      })}
    >
      <Icon name="calendar" size={18} color={t.tealText} />
      <Text variant="body" tabular style={{ flex: 1 }}>
        {formatDay(value)}
      </Text>
      {expanded !== undefined && (
        <View style={{ transform: [{ rotate: expanded ? "180deg" : "0deg" }] }}>
          <Icon name="chevronDown" size={14} color={t.mutedText} />
        </View>
      )}
    </Pressable>
  );
}
