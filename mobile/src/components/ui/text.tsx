import { Text as RNText, type TextProps } from "react-native";

import { type as typeScale, useTheme, type Palette, type TypeVariant } from "@/theme";

type Props = TextProps & {
  variant?: TypeVariant;
  /** A colour token; defaults to ink. */
  tone?: keyof Palette;
  /** Tabular figures for times and counts. */
  tabular?: boolean;
  center?: boolean;
};

export function Text({ variant = "body", tone = "ink", tabular, center, style, ...rest }: Props) {
  const t = useTheme();
  return (
    <RNText
      maxFontSizeMultiplier={1.6}
      style={[
        typeScale[variant],
        { color: t[tone] },
        tabular && { fontVariant: ["tabular-nums"] },
        center && { textAlign: "center" },
        style,
      ]}
      {...rest}
    />
  );
}
