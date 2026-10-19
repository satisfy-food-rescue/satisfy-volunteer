import { TextInput, View, type TextInputProps } from "react-native";

import { font, radius, useTheme } from "@/theme";

import { Icon } from "./icon";
import { Text } from "./text";

type Props = TextInputProps & { label: string; hint?: string; optional?: boolean; error?: string; ref?: React.Ref<TextInput> };

/** A labelled text input. Readonly fields show as muted, not disabled grey.
 *  An error shows under it with an icon, never colour alone. */
export function Field({ label, hint, optional, error, multiline, editable = true, style, ...rest }: Props) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text variant="bodySemibold">
        {label}
        {optional && (
          <Text variant="body" tone="mutedText">
            {" "}
            (optional)
          </Text>
        )}
      </Text>
      <TextInput
        accessibilityLabel={error ? `${label}, ${error}` : label}
        accessibilityHint={hint}
        editable={editable}
        multiline={multiline}
        placeholderTextColor={t.mutedText}
        selectionColor={t.tealText}
        maxFontSizeMultiplier={1.6}
        style={[
          {
            minHeight: multiline ? 88 : 50,
            paddingHorizontal: 14,
            paddingTop: multiline ? 12 : 0,
            paddingBottom: multiline ? 12 : 0,
            borderRadius: radius.lg,
            borderCurve: "continuous",
            borderWidth: error ? 2 : 1,
            borderColor: error ? t.bad : t.input,
            backgroundColor: editable ? t.card : t.muted,
            color: editable ? t.ink : t.mutedText,
            fontFamily: font.regular,
            fontSize: 16,
            textAlignVertical: multiline ? "top" : "center",
          },
          style,
        ]}
        {...rest}
      />
      {hint && (
        <Text variant="caption" tone="mutedText">
          {hint}
        </Text>
      )}
      {/* Read out with the input's label instead. */}
      {error && <FieldErrorText hidden>{error}</FieldErrorText>}
    </View>
  );
}

/** A message about one field, under it. `hidden` keeps it from being read
 *  twice when the control already announces it. */
export function FieldErrorText({ children, hidden }: { children: string; hidden?: boolean }) {
  const t = useTheme();
  return (
    <View
      style={{ flexDirection: "row", gap: 6, alignItems: "flex-start" }}
      importantForAccessibility={hidden ? "no-hide-descendants" : "auto"}
      accessibilityElementsHidden={hidden}
      accessibilityRole={hidden ? undefined : "alert"}
    >
      <Icon name="alert" size={14} color={t.bad} />
      <Text variant="smallSemibold" tone="bad" style={{ flex: 1, marginTop: -2 }}>
        {children}
      </Text>
    </View>
  );
}

/** A titled group of fields, like a fieldset on the web. */
export function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <Text variant="eyebrow" tone="mutedText" style={{ paddingHorizontal: 4 }} accessibilityRole="header">
        {title}
      </Text>
      <View style={{ gap: 16, padding: 16, borderRadius: radius.card, borderCurve: "continuous", borderWidth: 1, borderColor: t.border, backgroundColor: t.card }}>{children}</View>
    </View>
  );
}
