import MaskedView from "@react-native-masked-view/masked-view";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/theme";

/** How far below the status bar the blur fades out. */
const FADE = 28;

/** Sits behind the status bar on screens with no navigation bar, so content
 *  scrolling beneath it softens instead of colliding with the clock. On iOS
 *  it is the system's scroll edge: an untinted blur that fades out below the
 *  status bar and only appears while content is under it (`active`). Android
 *  keeps the solid band its status bars use. */
export function StatusBarScrim({ active }: { active: boolean }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  if (process.env.EXPO_OS !== "ios") {
    return <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, height: insets.top, backgroundColor: t.hero }} />;
  }
  if (!active) return null;
  const height = insets.top + FADE;
  return (
    <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(180)} pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, height }}>
      <MaskedView
        style={{ flex: 1 }}
        maskElement={<LinearGradient colors={["black", "black", "transparent"]} locations={[0, insets.top / height, 1]} style={{ flex: 1 }} />}
      >
        <BlurView intensity={24} tint="systemUltraThinMaterial" style={{ flex: 1 }} />
      </MaskedView>
    </Animated.View>
  );
}
