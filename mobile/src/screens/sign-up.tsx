import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { createRef, useState } from "react";
import { Pressable, TextInput, View } from "react-native";

import type { SignUpField, SignUpInput } from "@satisfy/core/api";
import { ROLE_DESCRIPTION, ROLE_LABEL, VOLUNTEER_ROLES, type VolunteerRole } from "@satisfy/core/domain";
import { SIGN_UP_HINT, SIGN_UP_INTRO, SIGN_UP_PRIVACY, SIGN_UP_THANKS, signUpSteps, type SignUpStep } from "@satisfy/core/sign-up";
import { Notice, Panel, SignedOutFrame } from "@/components/signed-out";
import { Button } from "@/components/ui/button";
import { Field, FieldErrorText } from "@/components/ui/field";
import { Icon, type IconName } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { ApiError } from "@/lib/api";
import { API_URL } from "@/lib/config";
import { actions } from "@/lib/queries";
import { radius, useTheme } from "@/theme";

type Values = Omit<SignUpInput, "birthYear"> & { birthYear: string };
type Errors = Partial<Record<SignUpField, string>>;

const EMPTY: Values = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  suburb: "",
  birthYear: "",
  interests: [],
  availability: "",
  emergencyName: "",
  emergencyPhone: "",
  message: "",
  privacy: false,
};

/** Text fields in the order they are filled in, for the keyboard's Next key
 *  and for jumping to the first one that needs fixing. */
const TEXT_ORDER = ["firstName", "lastName", "email", "phone", "suburb", "birthYear", "availability", "emergencyName", "emergencyPhone", "message"] as const;
type TextKey = (typeof TEXT_ORDER)[number];

/** Signing up to volunteer, the same form as /sign-up on the website. It
 *  sends an application: the coordinator's approval creates the account. */
export function SignUpScreen() {
  const [sent, setSent] = useState<{ firstName: string; email: string } | null>(null);
  const back = () => (router.canGoBack() ? router.back() : router.replace("/sign-in"));
  return (
    <SignedOutFrame back={{ label: "Sign in", onPress: back }}>
      {sent ? <Sent {...sent} onDone={back} /> : <SignUpForm onSent={setSent} />}
    </SignedOutFrame>
  );
}

function SignUpForm({ onSent }: { onSent: (who: { firstName: string; email: string }) => void }) {
  const [v, setV] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refs] = useState(() => Object.fromEntries(TEXT_ORDER.map((k) => [k, createRef<TextInput>()])) as Record<TextKey, React.RefObject<TextInput | null>>);

  const set = <K extends keyof Values>(key: K, value: Values[K]) => {
    setV((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };
  const text = (key: TextKey) => {
    const next = TEXT_ORDER[TEXT_ORDER.indexOf(key) + 1];
    const multiline = key === "availability" || key === "message";
    return {
      ref: refs[key],
      value: v[key],
      onChangeText: (value: string) => set(key, value),
      error: errors[key],
      ...(!multiline && {
        returnKeyType: next ? ("next" as const) : ("done" as const),
        submitBehavior: next ? ("submit" as const) : ("blurAndSubmit" as const),
        onSubmitEditing: () => (next ? refs[next].current?.focus() : undefined),
      }),
    };
  };

  const submit = async () => {
    setBusy(true);
    setNotice(null);
    const year = v.birthYear.trim();
    const input: SignUpInput = { ...v, birthYear: year === "" ? null : /^\d+$/.test(year) ? Number(year) : 0 };
    try {
      await actions.signUp(input);
      if (process.env.EXPO_OS === "ios") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSent({ firstName: v.firstName.trim(), email: v.email.trim() });
    } catch (e) {
      if (process.env.EXPO_OS === "ios") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const fields = e instanceof ApiError ? (e.fields as Errors) : {};
      setErrors(fields);
      if (Object.keys(fields).length === 0) setNotice(e instanceof Error ? e.message : "Couldn't send your application. Please try again.");
      const first = TEXT_ORDER.find((k) => fields[k]);
      if (first) refs[first].current?.focus();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="Sign up to volunteer" subtitle={SIGN_UP_INTRO}>
      <Section title="About you">
        <Field label="First name" textContentType="givenName" autoComplete="given-name" autoCapitalize="words" {...text("firstName")} />
        <Field label="Last name" textContentType="familyName" autoComplete="family-name" autoCapitalize="words" {...text("lastName")} />
        <Field label="Email" hint={SIGN_UP_HINT.email} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} textContentType="emailAddress" autoComplete="email" {...text("email")} />
        <Field label="Mobile" keyboardType="phone-pad" textContentType="telephoneNumber" autoComplete="tel" {...text("phone")} />
        <Field label="Suburb or town" textContentType="addressCity" autoComplete="postal-address-locality" autoCapitalize="words" {...text("suburb")} />
        <Field label="Year of birth" optional keyboardType="number-pad" maxLength={4} {...text("birthYear")} />
      </Section>

      <Section title="How you would like to help" hint={SIGN_UP_HINT.interests}>
        <View style={{ gap: 8 }}>
          {VOLUNTEER_ROLES.map((r) => (
            <RoleOption
              key={r}
              role={r}
              checked={v.interests.includes(r)}
              onChange={(on) => set("interests", on ? VOLUNTEER_ROLES.filter((x) => x === r || v.interests.includes(x)) : v.interests.filter((x) => x !== r))}
            />
          ))}
        </View>
        {errors.interests && <FieldErrorText>{errors.interests}</FieldErrorText>}
      </Section>

      <Section title="When you are free">
        <Field label="Usual availability" hint={SIGN_UP_HINT.availability} multiline maxLength={300} {...text("availability")} />
      </Section>

      <Section title="Emergency contact" hint={SIGN_UP_HINT.emergency}>
        <Field label="Their name" autoCapitalize="words" autoComplete="off" {...text("emergencyName")} />
        <Field label="Their phone" keyboardType="phone-pad" autoComplete="off" {...text("emergencyPhone")} />
      </Section>

      <Section title="Anything else?">
        <Field label="Message for the coordinator" optional hint={SIGN_UP_HINT.message} multiline maxLength={1000} {...text("message")} />
      </Section>

      <View style={{ gap: 6 }}>
        <Privacy checked={v.privacy} invalid={Boolean(errors.privacy)} onChange={(on) => set("privacy", on)} />
        {errors.privacy && <FieldErrorText>{errors.privacy}</FieldErrorText>}
      </View>

      {notice && <Notice tone="error">{notice}</Notice>}
      {Object.keys(errors).length > 1 && <Notice tone="error">A few details need fixing. They are marked above.</Notice>}
      <Button label="Send my application" icon="send" block loading={busy} onPress={() => void submit()} />
    </Panel>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 12, marginTop: 4 }}>
      <View style={{ gap: 2 }}>
        <Text variant="eyebrow" tone="tealText" accessibilityRole="header">
          {title}
        </Text>
        {hint && (
          <Text variant="small" tone="mutedText">
            {hint}
          </Text>
        )}
      </View>
      {children}
    </View>
  );
}

function TickBox({ checked }: { checked: boolean }) {
  const t = useTheme();
  return (
    <View
      style={{
        width: 24,
        height: 24,
        borderRadius: 7,
        borderWidth: 2,
        borderColor: checked ? t.primary : t.input,
        backgroundColor: checked ? t.primary : "transparent",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {checked && <Icon name="check" size={14} color={t.white} />}
    </View>
  );
}

function RoleOption({ role, checked, onChange }: { role: VolunteerRole; checked: boolean; onChange: (on: boolean) => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={ROLE_LABEL[role]}
      accessibilityHint={ROLE_DESCRIPTION[role]}
      onPress={() => onChange(!checked)}
      style={({ pressed }) => ({
        flexDirection: "row",
        gap: 12,
        padding: 14,
        borderRadius: radius.lg,
        borderCurve: "continuous",
        borderWidth: checked ? 2 : 1,
        borderColor: checked ? t.primary : t.border,
        backgroundColor: checked ? t.tealTint : pressed ? t.muted : t.card,
      })}
    >
      <TickBox checked={checked} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodySemibold" tone={checked ? "tealDeep" : "ink"}>
          {ROLE_LABEL[role]}
        </Text>
        <Text variant="small" tone="inkSoft">
          {ROLE_DESCRIPTION[role]}
        </Text>
      </View>
    </Pressable>
  );
}

function Privacy({ checked, invalid, onChange }: { checked: boolean; invalid: boolean; onChange: (on: boolean) => void }) {
  const t = useTheme();
  const sentence = `${SIGN_UP_PRIVACY.before} ${SIGN_UP_PRIVACY.link} ${SIGN_UP_PRIVACY.after}`;
  return (
    <View style={{ gap: 4 }}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={sentence}
        onPress={() => onChange(!checked)}
        style={{ flexDirection: "row", gap: 12, padding: 14, borderRadius: radius.lg, borderCurve: "continuous", borderWidth: invalid ? 2 : 1, borderColor: invalid ? t.bad : t.border }}
      >
        <TickBox checked={checked} />
        <Text variant="body" style={{ flex: 1 }}>
          {sentence}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="link"
        accessibilityHint="Opens in the browser"
        onPress={() => void WebBrowser.openBrowserAsync(`${API_URL}/privacy`)}
        style={({ pressed }) => ({ alignSelf: "flex-start", minHeight: 44, justifyContent: "center", opacity: pressed ? 0.6 : 1 })}
      >
        <Text variant="smallSemibold" tone="tealText" style={{ textDecorationLine: "underline" }}>
          Read the privacy policy
        </Text>
      </Pressable>
    </View>
  );
}

const STEP_ICON: Record<SignUpStep["key"], IconName> = { read: "mail", invite: "key", call: "phone", book: "calendarCheck" };

function Sent({ firstName, email, onDone }: { firstName: string; email: string; onDone: () => void }) {
  const t = useTheme();
  return (
    <Panel title={`Thanks, ${firstName}`} subtitle={SIGN_UP_THANKS}>
      <View style={{ gap: 16 }}>
        {signUpSteps(email).map((s, i) => (
          <View key={s.key} style={{ flexDirection: "row", gap: 14 }} accessible accessibilityLabel={`Step ${i + 1}: ${s.title}. ${s.body}`}>
            <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: t.tealTint }}>
              <Icon name={STEP_ICON[s.key]} size={18} color={t.tealText} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="bodyBold">{s.title}</Text>
              <Text variant="body" tone="inkSoft">
                {s.body}
              </Text>
            </View>
          </View>
        ))}
      </View>
      <Button label="Back to sign in" variant="outline" block onPress={onDone} />
    </Panel>
  );
}
