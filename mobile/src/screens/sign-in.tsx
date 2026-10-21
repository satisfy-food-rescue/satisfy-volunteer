import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, TextInput, View } from "react-native";

import type { AuthConfig, DemoPersona, DemoPersonas } from "@satisfy/core/api";
import { AppleMark } from "@/components/brand/apple-mark";
import { GoogleMark } from "@/components/brand/google-mark";
import { Photo } from "@/components/photo";
import { HeroLink, Notice, Panel, SignedOutFrame } from "@/components/signed-out";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Icon, type IconName } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { actions, useAppleSupported, useAuthConfig } from "@/lib/queries";
import { Cancelled, passkeysSupported } from "@/lib/sign-in";
import { radius, useTheme } from "@/theme";

/** Signing in: email and password, Google, Apple or a passkey, the same as
 *  the website. The demo deployment shows a persona picker instead. */
export function SignInScreen() {
  const t = useTheme();
  const config = useAuthConfig();
  return (
    <SignedOutFrame>
      {config.data ? (
        config.data.demo ? (
          <DemoPersonaList />
        ) : (
          <SignInForm config={config.data} />
        )
      ) : config.error ? (
        <View style={{ gap: 12, padding: 16, borderRadius: radius.card, borderCurve: "continuous", backgroundColor: "rgba(255,255,255,0.1)" }}>
          <Text variant="bodySemibold" tone="white" selectable>
            {config.error.message}
          </Text>
          <Button label="Try again" variant="onHero" onPress={() => config.refetch()} />
        </View>
      ) : (
        <ActivityIndicator color={t.white} style={{ paddingVertical: 32 }} accessibilityLabel="Loading" />
      )}
    </SignedOutFrame>
  );
}

function Divider() {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <View style={{ flex: 1, height: 1, backgroundColor: t.border }} />
      <Text variant="small" tone="mutedText">
        or
      </Text>
      <View style={{ flex: 1, height: 1, backgroundColor: t.border }} />
    </View>
  );
}

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : "Couldn't sign in. Please try again.";
}

type Mode = { kind: "signIn" } | { kind: "link"; firstTime: boolean };

function SignInForm({ config }: { config: AuthConfig }) {
  const t = useTheme();
  const auth = useAuth();
  const [mode, setMode] = useState<Mode>({ kind: "signIn" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"password" | "google" | "apple" | "passkey" | "link" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);
  const passkeys = config.passkeys && passkeysSupported();
  const appleOnThisPhone = useAppleSupported();
  const apple = config.apple && appleOnThisPhone;

  const run = async (which: NonNullable<typeof busy>, task: () => Promise<void>) => {
    setBusy(which);
    setError(null);
    try {
      await task();
    } catch (e) {
      if (!(e instanceof Cancelled)) setError(errorText(e));
    } finally {
      setBusy(null);
    }
  };
  const submitPassword = () => {
    if (!email.trim() || !password) return setError("Enter your email and password.");
    void run("password", () => auth.signInWithPassword({ email: email.trim(), password }));
  };

  // First on iOS, where it is the phone's own sign-in; after Google elsewhere.
  const appleButton = (
    <Button
      label="Continue with Apple"
      variant="outline"
      leading={<AppleMark size={18} color={t.ink} />}
      block
      loading={busy === "apple"}
      disabled={busy !== null && busy !== "apple"}
      onPress={() => void run("apple", auth.signInWithApple)}
    />
  );

  if (mode.kind === "link") {
    return (
      <Panel title={mode.firstTime ? "Set up your password" : "Forgot your password?"}>
        <Text variant="body" tone="inkSoft">
          {mode.firstTime
            ? "Enter the email address you volunteer with. We'll email you a link to choose a password, then come back here to sign in."
            : "Enter the email address you volunteer with and we'll email you a link to choose a new password."}
        </Text>
        <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} textContentType="username" autoComplete="email" returnKeyType="send" />
        {error && <Notice tone="error">{error}</Notice>}
        {sent && <Notice tone="success">{sent}</Notice>}
        <Button
          label="Email me a link"
          icon="mail"
          block
          loading={busy === "link"}
          onPress={() => {
            if (!email.trim()) return setError("Enter the email address you volunteer with.");
            setSent(null);
            void run("link", async () => setSent((await actions.requestSignInLink(email.trim())).message));
          }}
        />
        <Button
          label="Back to sign in"
          variant="ghost"
          onPress={() => {
            setError(null);
            setSent(null);
            setMode({ kind: "signIn" });
          }}
        />
      </Panel>
    );
  }

  return (
    <>
      <Panel title="Sign in" subtitle="For volunteers at Satisfy Food Rescue.">
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="username"
          autoComplete="email"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        <View style={{ gap: 4 }}>
          <Field
            ref={passwordRef}
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="password"
            autoComplete="current-password"
            returnKeyType="go"
            onSubmitEditing={submitPassword}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setError(null);
              setMode({ kind: "link", firstTime: false });
            }}
            style={{ alignSelf: "flex-end", minHeight: 44, justifyContent: "center" }}
          >
            <Text variant="smallSemibold" tone="tealText">
              Forgot your password?
            </Text>
          </Pressable>
        </View>
        {error && <Notice tone="error">{error}</Notice>}
        <Button label="Sign in" icon="arrowRight" block loading={busy === "password"} disabled={busy !== null && busy !== "password"} onPress={submitPassword} />
        {(config.google || apple || passkeys) && <Divider />}
        {apple && Platform.OS === "ios" && appleButton}
        {config.google && (
          <Button
            label="Continue with Google"
            variant="outline"
            leading={<GoogleMark size={18} />}
            block
            loading={busy === "google"}
            disabled={busy !== null && busy !== "google"}
            onPress={() => void run("google", auth.signInWithGoogle)}
          />
        )}
        {apple && Platform.OS !== "ios" && appleButton}
        {passkeys && (
          <Button
            label="Sign in with a passkey"
            variant="outline"
            icon="passkey"
            block
            loading={busy === "passkey"}
            disabled={busy !== null && busy !== "passkey"}
            onPress={() => void run("passkey", auth.signInWithPasskey)}
          />
        )}
      </Panel>
      <View style={{ gap: 4 }}>
        <HeroLink lead="New to Satisfy?" action="Sign up to volunteer" onPress={() => router.push("/sign-up")} />
        <HeroLink
          lead="Already volunteering but never signed in?"
          action="Set up your password"
          onPress={() => {
            setError(null);
            setMode({ kind: "link", firstTime: true });
          }}
        />
      </View>
    </>
  );
}

// Demo -----------------------------------------------------------------------

const PERSONA_ICON: Record<string, IconName> = { margaret: "warehouse", tony: "truck", jess: "leaf" };

function DemoPersonaList() {
  const t = useTheme();
  const personas = useQuery({ queryKey: ["personas"], queryFn: () => api<DemoPersonas>("/auth/personas") });
  return (
    <>
      <View style={{ gap: 8 }}>
        <Text variant="hero" tone="white" accessibilityRole="header">
          Kia ora. Your roster, training and cover in one place.
        </Text>
        <Text variant="body" tone="white" style={{ opacity: 0.85 }}>
          Demo build for Satisfy Food Rescue. Pick a volunteer to explore. Nothing here sends real email or touches Infoodle.
        </Text>
      </View>
      <Photo photo="team" style={{ aspectRatio: 2, borderRadius: radius.card, borderCurve: "continuous" }} />
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
      <HeroLink lead="New to Satisfy?" action="Sign up to volunteer" onPress={() => router.push("/sign-up")} />
    </>
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
          toast.show(errorText(e), "error");
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
