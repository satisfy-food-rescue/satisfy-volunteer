import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { formatDay } from "@satisfy/core/dates";
import { isoToLocalDate, localDateToISO } from "@/lib/calendar-date";
import { radius, useTheme } from "@/theme";

import { Icon } from "./ui/icon";
import { Text } from "./ui/text";

export type DateFieldProps = { label: string; value: string; min?: string; onChange: (iso: string) => void };

/** A calendar date field that opens the Material date dialog. iOS uses the
 *  compact system picker instead (date-field.ios.tsx). Values are "YYYY-MM-DD". */
export function DateField({ label, value, min, onChange }: DateFieldProps) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ flex: 1, gap: 6 }}>
      <Text variant="bodySemibold">{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${formatDay(value)}`}
        onPress={() => setOpen(true)}
        style={{ minHeight: 50, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, borderRadius: radius.lg, borderWidth: 1, borderColor: t.input, backgroundColor: t.card }}
      >
        <Icon name="calendar" size={18} color={t.tealText} />
        <Text variant="body">{formatDay(value)}</Text>
      </Pressable>
      {open && (
        <DateTimePicker
          value={isoToLocalDate(value)}
          minimumDate={min ? isoToLocalDate(min) : undefined}
          mode="date"
          accentColor={t.primary}
          onChange={(event, date) => {
            setOpen(false);
            if (event.type === "set" && date) onChange(localDateToISO(date));
          }}
        />
      )}
    </View>
  );
}
