import { StatusBar } from "expo-status-bar";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrandWaves, FoodIcon, Logo } from "@/components/brand/logo";
import { LegalLinks } from "@/components/legal-links";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { radius, useTheme } from "@/theme";

// The pieces every signed-out screen (sign in, sign up) is built from.

/** The teal brand band every signed-out screen sits on, with the privacy
 *  and terms links above the brand footer. `back` adds a way back to the
 *  screen before, labelled with its name. */
export function SignedOutFrame({ children, back }: { children: React.ReactNode; back?: { label: string; onPress: () => void } }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: t.hero }}>
      <StatusBar style="light" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ paddingTop: insets.top + (back ? 4 : 24), paddingBottom: insets.bottom + 16, paddingHorizontal: 20, gap: 24, flexGrow: 1 }}
      >
        {back && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Back to ${back.label.toLowerCase()}`}
            onPress={back.onPress}
            hitSlop={8}
            style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", minHeight: 44, opacity: pressed ? 0.6 : 1, marginBottom: -12 })}
          >
            <Icon name="chevronLeft" size={16} color={t.white} />
            <Text variant="bodySemibold" tone="white">
              {back.label}
            </Text>
          </Pressable>
        )}
        <Logo height={back ? 80 : 104} color={t.white} />
        {children}
        <View style={{ flex: 1 }} />
        <LegalLinks onHero />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginHorizontal: -20, paddingRight: 20 }}>
          <View style={{ flex: 1, opacity: 0.9 }}>
            <BrandWaves height={36} />
          </View>
          {(["broccoli", "carrot", "apple"] as const).map((k) => (
            <FoodIcon key={k} kind={k} size={26} ringed />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

/** An inline message under a form. Icon plus text, never colour alone. */
export function Notice({ tone, children }: { tone: "error" | "success"; children: string }) {
  const t = useTheme();
  return (
    <View
      accessibilityRole={tone === "error" ? "alert" : "text"}
      accessibilityLiveRegion="polite"
      style={{ flexDirection: "row", gap: 10, padding: 12, borderRadius: radius.lg, borderCurve: "continuous", backgroundColor: tone === "error" ? t.badTint : t.greenTint }}
    >
      <Icon name={tone === "error" ? "alert" : "checkCircle"} size={18} color={tone === "error" ? t.bad : t.greenText} />
      <Text variant="small" tone={tone === "error" ? "bad" : "greenDeep"} style={{ flex: 1 }} selectable>
        {children}
      </Text>
    </View>
  );
}

/** The white card a signed-out form sits in. */
export function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ gap: 16, padding: 20, borderRadius: radius.card, borderCurve: "continuous", backgroundColor: t.card }}>
      <View style={{ gap: 4 }}>
        <Text variant="display" accessibilityRole="header">
          {title}
        </Text>
        {subtitle && (
          <Text variant="body" tone="inkSoft">
            {subtitle}
          </Text>
        )}
      </View>
      {children}
    </View>
  );
}

/** A link-style line on the teal band, such as "New to Satisfy? Sign up". */
export function HeroLink({ lead, action, onPress }: { lead: string; action: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${lead} ${action}`} onPress={onPress} style={({ pressed }) => ({ minHeight: 44, justifyContent: "center", paddingHorizontal: 8, opacity: pressed ? 0.6 : 1 })}>
      <Text variant="body" tone="white" center>
        {lead}{" "}
        <Text variant="bodyBold" tone="white" style={{ textDecorationLine: "underline", color: t.white }}>
          {action}
        </Text>
      </Text>
    </Pressable>
  );
}
