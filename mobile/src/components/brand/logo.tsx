import Svg, { G, Path } from "react-native-svg";

import { useTheme } from "@/theme";
import { DISC, FOOD_GLYPH, FOOD_VIEWBOX, ICON, ICON_VIEWBOX, LOGO_VIEWBOX, SMILE, TAGLINE, WAVES, WAVES_VIEWBOX, WORDMARK } from "./paths";

const LOGO_RATIO = 110.23 / 105.69;

/** The full stacked logo: icon, SATISFY, FOOD RESCUE and the smile. */
export function Logo({ height, color }: { height: number; color: string }) {
  return (
    <Svg width={height * LOGO_RATIO} height={height} viewBox={LOGO_VIEWBOX} accessibilityLabel="Satisfy Food Rescue" accessibilityRole="image">
      <G fill={color}>
        {[...ICON, ...WORDMARK, ...TAGLINE, SMILE].map((d, i) => (
          <Path key={i} d={d} />
        ))}
      </G>
    </Svg>
  );
}

/** Just the produce-and-cutlery icon. */
export function LogoIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size * (26.7 / 28.6)} viewBox={ICON_VIEWBOX} accessibilityLabel="Satisfy Food Rescue" accessibilityRole="image">
      <G fill={color}>
        {ICON.map((d, i) => (
          <Path key={i} d={d} />
        ))}
      </G>
    </Svg>
  );
}

export type FoodKind = keyof typeof FOOD_GLYPH;

/** A white food glyph on a brand-coloured disc, as in the brand footer. */
export function FoodIcon({ kind, size }: { kind: FoodKind; size: number }) {
  const t = useTheme();
  const disc = { broccoli: t.green75, carrot: t.orange, apple: t.teal }[kind];
  return (
    <Svg width={size} height={size} viewBox={FOOD_VIEWBOX} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d={DISC} fill={disc} />
      <Path d={FOOD_GLYPH[kind]} fill={t.white} />
    </Svg>
  );
}

/** The brand footer ribbons. The web multiplies the teal ribbon over the
 *  orange one; react-native-svg has no blend modes, so the opacities carry it. */
export function BrandWaves({ height }: { height: number }) {
  const t = useTheme();
  return (
    <Svg width="100%" height={height} viewBox={WAVES_VIEWBOX} preserveAspectRatio="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d={WAVES.orange} fill={t.orange50} opacity={0.8} />
      <Path d={WAVES.teal} fill={t.teal90} opacity={0.7} />
      <Path d={WAVES.green} fill={t.green50} opacity={0.8} />
    </Svg>
  );
}
