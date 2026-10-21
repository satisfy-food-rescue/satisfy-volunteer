import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import { useState } from "react";
import { View } from "react-native";

import { isoToLocalDate, localDateToISO } from "@/lib/calendar-date";
import { useTheme } from "@/theme";

import { DateButton } from "./date-button";
import { Text } from "./ui/text";

export type DateFieldProps = { label: string; value: string; min?: string; onChange: (iso: string) => void };

/** A calendar date field that opens the Material date dialog. iOS opens the
 *  system calendar inline instead (date-field.ios.tsx). Values are
 *  "YYYY-MM-DD". */
export function DateField({ label, value, min, onChange }: DateFieldProps) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Text variant="bodySemibold">{label}</Text>
      <DateButton label={label} value={value} onPress={() => setOpen(true)} />
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
