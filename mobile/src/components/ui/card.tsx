import { View, type ViewProps } from "react-native";

import { radius, useTheme, type Palette } from "@/theme";

type Props = ViewProps & {
  /** Border colour token; defaults to the hairline border. */
  border?: keyof Palette;
  background?: keyof Palette;
  padded?: boolean;
  /** The lifted look used for the next-shift card on Home. */
  raised?: boolean;
};

export function Card({ border = "border", background = "card", padded = true, raised, style, ...rest }: Props) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: t[background],
          borderColor: t[border],
          borderWidth: 1,
          borderRadius: radius.card,
          borderCurve: "continuous",
          overflow: "hidden",
        },
        padded && { padding: 16 },
        raised && { boxShadow: `0 12px 32px -16px ${t.shadow}` },
        style,
      ]}
      {...rest}
    />
  );
}
