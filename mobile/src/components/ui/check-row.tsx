import { Pressable, View } from "react-native";

import { radius, useTheme } from "@/theme";

import { Icon } from "./icon";
import { Text } from "./text";

/** A tick box with its sentence, the whole row tappable: "I have read...".
 *  `children` is the sentence, and may nest bold Text. */
export function CheckRow({ checked, onToggle, disabled, children }: { checked: boolean; onToggle: () => void; disabled?: boolean; children: React.ReactNode }) {
  const t = useTheme();
  const on = checked && !disabled;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on, disabled: !!disabled }}
      disabled={disabled}
      onPress={onToggle}
      style={{
        flexDirection: "row",
        gap: 12,
        padding: 14,
        borderRadius: radius.lg,
        borderCurve: "continuous",
        backgroundColor: t.card,
        borderWidth: 1,
        borderColor: on ? t.tealText : t.border,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 7,
          borderWidth: 2,
          borderColor: on ? t.primary : t.input,
          backgroundColor: on ? t.primary : "transparent",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {on && <Icon name="check" size={14} color={t.white} />}
      </View>
      <Text variant="body" style={{ flex: 1 }}>
        {children}
      </Text>
    </Pressable>
  );
}
