import * as Haptics from "expo-haptics";
import { ActivityIndicator, Pressable, View } from "react-native";

import { radius, TAP, useTheme, type Palette } from "@/theme";

import { Icon, type IconName } from "./icon";
import { Text } from "./text";

export type ButtonVariant = "primary" | "cover" | "outline" | "ghost" | "onHero";

type Props = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  /** Fills the row; otherwise the button hugs its label. */
  block?: boolean;
  size?: "md" | "lg";
  accessibilityHint?: string;
};

const STYLES: Record<ButtonVariant, { bg: keyof Palette | null; pressed: keyof Palette | null; fg: keyof Palette; border: keyof Palette | null }> = {
  primary: { bg: "primary", pressed: "primaryPressed", fg: "white", border: null },
  cover: { bg: "orange", pressed: "orangePressed", fg: "onOrange", border: null },
  outline: { bg: "card", pressed: "muted", fg: "ink", border: "input" },
  ghost: { bg: null, pressed: "muted", fg: "mutedText", border: null },
  onHero: { bg: "white", pressed: "tealTint", fg: "teal", border: null },
};

export function Button({ label, onPress, variant = "primary", icon, loading, disabled, block, size = "lg", accessibilityHint }: Props) {
  const t = useTheme();
  const s = STYLES[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={() => {
        if (process.env.EXPO_OS === "ios") Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => ({
        minHeight: size === "lg" ? 52 : TAP,
        paddingHorizontal: variant === "ghost" ? 12 : 18,
        borderRadius: radius.lg,
        borderCurve: "continuous",
        alignSelf: block ? "stretch" : "flex-start",
        flexGrow: block ? 1 : 0,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: pressed && s.pressed ? t[s.pressed] : s.bg ? t[s.bg] : "transparent",
        borderWidth: s.border ? 1 : 0,
        borderColor: s.border ? t[s.border] : undefined,
        opacity: disabled && !loading ? 0.45 : 1,
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {loading ? <ActivityIndicator color={t[s.fg]} /> : icon && <Icon name={icon} size={18} color={t[s.fg]} />}
        <Text variant={size === "lg" ? "bodyBold" : "smallBold"} tone={s.fg}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
