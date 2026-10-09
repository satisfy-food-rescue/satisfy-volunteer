import { ActivityIndicator, View } from "react-native";

import { useTheme } from "@/theme";

import { Button } from "./button";
import { Icon, type IconName } from "./icon";
import { Text } from "./text";

/** First load of a screen. Never shown once there is data to keep showing. */
export function LoadingState() {
  const t = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 64 }}>
      <ActivityIndicator size="large" color={t.tealText} accessibilityLabel="Loading" />
    </View>
  );
}

/** A load failed with nothing cached to show. */
export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: "center", gap: 12, paddingHorizontal: 24, paddingVertical: 48 }}>
      <Icon name="wifiOff" size={36} color={t.mutedText} />
      <Text variant="heading" center>
        Couldn&apos;t load this
      </Text>
      <Text variant="body" tone="mutedText" center selectable>
        {message}
      </Text>
      <Button label="Try again" variant="outline" onPress={onRetry} />
    </View>
  );
}

/** A refresh failed but older data is still on screen. */
export function InlineError({ message, onRetry }: { message: string; onRetry: () => void }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 14, borderCurve: "continuous", backgroundColor: t.badTint }}>
      <Icon name="wifiOff" size={18} color={t.bad} />
      <Text variant="small" tone="bad" style={{ flex: 1 }} selectable>
        {message}
      </Text>
      <Button label="Retry" variant="ghost" size="md" onPress={onRetry} />
    </View>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: IconName; title: string; text: string; action?: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: "center", gap: 10, paddingHorizontal: 24, paddingVertical: 36, borderRadius: 24, borderCurve: "continuous", borderWidth: 1, borderStyle: "dashed", borderColor: t.border }}>
      <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: t.greenTint, alignItems: "center", justifyContent: "center" }}>
        <Icon name={icon} size={26} color={t.greenText} />
      </View>
      <Text variant="heading" center>
        {title}
      </Text>
      <Text variant="body" tone="mutedText" center>
        {text}
      </Text>
      {action}
    </View>
  );
}

/** A dashed one-liner for an empty sub-list. */
export function EmptyLine({ text }: { text: string }) {
  const t = useTheme();
  return (
    <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, borderCurve: "continuous", borderWidth: 1, borderStyle: "dashed", borderColor: t.border }}>
      <Text variant="small" tone="mutedText">
        {text}
      </Text>
    </View>
  );
}
