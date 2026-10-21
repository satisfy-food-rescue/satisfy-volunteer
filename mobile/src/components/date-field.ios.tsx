import { Host } from "@expo/ui";
import { DatePicker } from "@expo/ui/swift-ui";
import { datePickerStyle, tint } from "@expo/ui/swift-ui/modifiers";
import { useState } from "react";
import { View } from "react-native";

import { isoToLocalDate, localDateToISO } from "@/lib/calendar-date";
import { useTheme } from "@/theme";

import { DateButton } from "./date-button";
import type { DateFieldProps } from "./date-field";
import { Text } from "./ui/text";

/** A bordered date field, like the text fields, that opens the system
 *  calendar under it, as Calendar does for an event's dates. Picking a day
 *  closes it. */
export function DateField({ label, value, min, onChange }: DateFieldProps) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Text variant="bodySemibold">{label}</Text>
      <DateButton label={label} value={value} expanded={open} onPress={() => setOpen((o) => !o)} />
      {open && (
        <Host matchContents={{ vertical: true }} style={{ alignSelf: "stretch" }}>
          <DatePicker
            title={label}
            selection={isoToLocalDate(value)}
            range={min ? { start: isoToLocalDate(min) } : undefined}
            displayedComponents={["date"]}
            onDateChange={(date) => {
              onChange(localDateToISO(date));
              setOpen(false);
            }}
            modifiers={[datePickerStyle("graphical"), tint(t.primary)]}
          />
        </Host>
      )}
    </View>
  );
}
