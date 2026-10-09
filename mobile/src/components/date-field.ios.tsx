import { Host } from "@expo/ui";
import { DatePicker } from "@expo/ui/swift-ui";
import { datePickerStyle, frame, labelsHidden, tint } from "@expo/ui/swift-ui/modifiers";
import { View } from "react-native";

import { isoToLocalDate, localDateToISO } from "@/lib/calendar-date";
import { useTheme } from "@/theme";

import type { DateFieldProps } from "./date-field";
import { Text } from "./ui/text";

/** The compact system date picker, left-aligned under its label. */
export function DateField({ label, value, min, onChange }: DateFieldProps) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, gap: 6 }}>
      <Text variant="bodySemibold">{label}</Text>
      <Host matchContents={{ vertical: true }} style={{ alignSelf: "stretch" }}>
        <DatePicker
          title={label}
          selection={isoToLocalDate(value)}
          range={min ? { start: isoToLocalDate(min) } : undefined}
          displayedComponents={["date"]}
          onDateChange={(date) => onChange(localDateToISO(date))}
          modifiers={[datePickerStyle("compact"), labelsHidden(), tint(t.primary), frame({ maxWidth: 10000, alignment: "leading" })]}
        />
      </Host>
    </View>
  );
}
