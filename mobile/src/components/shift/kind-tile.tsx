import { View } from "react-native";

import type { ShiftKind } from "@satisfy/core/domain";
import { Icon } from "@/components/ui/icon";
import { radius, useTheme } from "@/theme";

/** Warehouse shifts are green, route shifts light blue, as on the web. */
export function KindTile({ kind, size = 44 }: { kind: ShiftKind; size?: number }) {
  const t = useTheme();
  const warehouse = kind === "WAREHOUSE";
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size >= 52 ? radius.xl : radius.md,
        borderCurve: "continuous",
        backgroundColor: warehouse ? t.greenTint : t.skyTint,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon name={warehouse ? "warehouse" : "truck"} size={Math.round(size * 0.5)} color={warehouse ? t.greenDeep : t.skyText} />
    </View>
  );
}
