import { Image, type ImageSource } from "expo-image";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import type { ShiftKind } from "@satisfy/core/domain";
import { PHOTOS, SHIFT_KIND_PHOTO, type PhotoKey } from "@satisfy/core/photos";
import { useTheme } from "@/theme";

const SRC: Record<PhotoKey, ImageSource> = {
  warehouse: require("@/assets/images/photos/warehouse.webp"),
  driverHelp: require("@/assets/images/photos/driver-help.webp"),
  driver: require("@/assets/images/photos/driver.webp"),
  harvest: require("@/assets/images/photos/harvest.webp"),
  team: require("@/assets/images/photos/team.webp"),
};

/**
 * A volunteer photo cropped to fill its box, as on the web. Size the box with
 * `style` (an aspectRatio or height). Inside a button the photo is decorative,
 * so pass `decorative` to keep its description out of what is read out.
 */
export function Photo({ photo, decorative, style }: { photo: PhotoKey; decorative?: boolean; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  const { focus, alt } = PHOTOS[photo];
  return (
    <View
      accessible={!decorative}
      accessibilityRole={decorative ? undefined : "image"}
      accessibilityLabel={decorative ? undefined : alt}
      importantForAccessibility={decorative ? "no-hide-descendants" : "yes"}
      accessibilityElementsHidden={decorative}
      style={[{ width: "100%", overflow: "hidden", backgroundColor: t.muted }, style]}
    >
      <Image
        source={SRC[photo]}
        contentFit="cover"
        contentPosition={{ left: `${focus.x}%`, top: `${focus.y}%` }}
        transition={150}
        accessibilityIgnoresInvertColors
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

export function shiftPhoto(kind: ShiftKind): PhotoKey {
  return SHIFT_KIND_PHOTO[kind];
}
