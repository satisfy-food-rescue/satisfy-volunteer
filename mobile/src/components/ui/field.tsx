import { TextInput, View, type TextInputProps } from "react-native";

import { font, radius, useTheme } from "@/theme";

import { Text } from "./text";

type Props = TextInputProps & { label: string; hint?: string; optional?: boolean };

/** A labelled text input. Readonly fields show as muted, not disabled grey. */
export function Field({ label, hint, optional, multiline, editable = true, style, ...rest }: Props) {
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
        accessibilityLabel={label}
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
            borderWidth: 1,
            borderColor: t.input,
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
