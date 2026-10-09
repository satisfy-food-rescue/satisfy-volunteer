import { useQuery } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { DemoPersona, DemoPersonas } from "@satisfy/core/api";
import { BrandWaves, FoodIcon, Logo } from "@/components/brand/logo";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { radius, useTheme } from "@/theme";

const PERSONA_ICON: Record<string, IconName> = { margaret: "warehouse", tony: "truck", jess: "leaf" };

/** Demo sign-in: pick a volunteer persona. The production build replaces
 *  this with email and password, Google and passkeys, as on the web. */
export function SignInScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const personas = useQuery({ queryKey: ["personas"], queryFn: () => api<DemoPersonas>("/auth/personas") });

  return (
    <View style={{ flex: 1, backgroundColor: t.hero }}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + 16, paddingHorizontal: 20, gap: 24, flexGrow: 1 }}>
        <Logo height={104} color={t.white} />
        <View style={{ gap: 8 }}>
          <Text variant="hero" tone="white" accessibilityRole="header">
            Kia ora. Your roster, training and cover in one place.
          </Text>
          <Text variant="body" tone="white" style={{ opacity: 0.85 }}>
            Demo build for Satisfy Food Rescue. Pick a volunteer to explore. Nothing here sends real email or touches Infoodle.
          </Text>
        </View>
        <View style={{ gap: 12 }}>
          {personas.data ? (
            personas.data.personas.map((p) => <PersonaCard key={p.key} persona={p} />)
          ) : personas.error ? (
            <View style={{ gap: 12, padding: 16, borderRadius: radius.card, backgroundColor: "rgba(255,255,255,0.1)" }}>
              <Text variant="bodySemibold" tone="white" selectable>
                {personas.error.message}
              </Text>
              <Button label="Try again" variant="onHero" onPress={() => personas.refetch()} />
            </View>
          ) : (
            <ActivityIndicator color={t.white} style={{ paddingVertical: 32 }} />
          )}
        </View>
        <View style={{ flex: 1 }} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginHorizontal: -20, paddingRight: 20 }}>
          <View style={{ flex: 1, opacity: 0.9 }}>
            <BrandWaves height={36} />
          </View>
          {(["broccoli", "carrot", "apple"] as const).map((k) => (
            <FoodIcon key={k} kind={k} size={26} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function PersonaCard({ persona }: { persona: DemoPersona }) {
  const t = useTheme();
  const { signInAsPersona } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Sign in as ${persona.firstName}, ${persona.label}`}
      accessibilityState={{ busy }}
      disabled={busy}
      onPress={async () => {
        setBusy(true);
        try {
          await signInAsPersona(persona.key);
        } catch (e) {
          toast.show(e instanceof Error ? e.message : "Couldn't sign in. Please try again.", "error");
          setBusy(false);
        }
      }}
      style={({ pressed }) => ({
        flexDirection: "row",
        gap: 14,
        padding: 16,
        borderRadius: radius.card,
        borderCurve: "continuous",
        backgroundColor: pressed ? t.muted : t.card,
      })}
    >
      <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: t.tealTint }}>
        <Icon name={PERSONA_ICON[persona.key] ?? "person"} size={20} color={t.tealText} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyBold">
          {persona.firstName} {persona.lastName}
        </Text>
        <Text variant="smallSemibold" tone="tealText">
          {persona.label}
        </Text>
        <Text variant="small" tone="inkSoft" style={{ marginTop: 2 }}>
          {persona.blurb}
        </Text>
      </View>
      <View style={{ justifyContent: "center" }}>{busy ? <ActivityIndicator color={t.tealText} /> : <Icon name="chevronRight" size={16} color={t.mutedText} />}</View>
    </Pressable>
  );
}
