import { Host, Switch } from "@expo/ui";
import { router, type Href } from "expo-router";
import { useEffect, useState } from "react";
import { AppState, Linking, Pressable, View } from "react-native";

import type { Me, MobileSession, ProfileInput } from "@satisfy/core/api";
import { formatDate } from "@satisfy/core/dates";
import { fullName, ROLE_LABEL } from "@satisfy/core/domain";
import { QueryScreen } from "@/components/screen";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Field, FieldGroup } from "@/components/ui/field";
import { Icon, type IconName } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth";
import { pushAvailability, pushPermission, registerForPush } from "@/lib/push";
import { actions, useAction, useSession } from "@/lib/queries";
import { useTheme } from "@/theme";

export function MeScreen() {
  const query = useSession();
  return (
    <QueryScreen query={query} automaticallyAdjustKeyboardInsets>
      {(session) => <Profile session={session} />}
    </QueryScreen>
  );
}

function Profile({ session }: { session: MobileSession }) {
  const { me } = session;
  return (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
        <Avatar person={me} size="lg" />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="title">{fullName(me)}</Text>
          <Text variant="small" tone="mutedText">
            Volunteer since {formatDate(me.joinedISO)}
          </Text>
          {me.inHarvestPool && (
            <View style={{ marginTop: 4 }}>
              <Chip tone="info" icon="leaf" small label="Harvest pool" />
            </View>
          )}
        </View>
      </View>
      <Roles me={me} />
      {me.infoodle && <Infoodle infoodle={me.infoodle} />}
      <Links />
      <NotificationsRow />
      <ProfileForm me={me} />
      <SignOut demo={session.demo} />
    </>
  );
}

function Roles({ me }: { me: Me }) {
  return (
    <Card style={{ gap: 12 }}>
      <View style={{ gap: 2 }}>
        <Text variant="title">My roles</Text>
        <Text variant="small" tone="mutedText">
          Your roles decide which shifts you can book and which training applies.
        </Text>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {me.roles.map((r) => (
          <Chip key={r} tone="good" label={ROLE_LABEL[r]} />
        ))}
      </View>
      <Button label="Ask to change my roles" variant="outline" size="md" onPress={() => router.push("/role-request")} />
    </Card>
  );
}

function Infoodle({ infoodle }: { infoodle: NonNullable<Me["infoodle"]> }) {
  const t = useTheme();
  return (
    <Card style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 }}>
      <Icon name="sync" size={20} color={t.lightBlue} />
      <View style={{ flex: 1 }}>
        <Text variant="bodySemibold">Synced with Infoodle</Text>
        <Text variant="small" tone="mutedText">
          {infoodle.syncedLabel ? `Last synced ${infoodle.syncedLabel}` : "Not yet synced"} · record {infoodle.id}
        </Text>
      </View>
    </Card>
  );
}

const LINKS: { href: Href; label: string; icon: IconName }[] = [
  { href: "/slot", label: "My regular slot and absences", icon: "calendarCheck" },
  { href: "/harvest", label: "Harvest pool", icon: "leaf" },
];

function Links() {
  const t = useTheme();
  return (
    <Card padded={false}>
      {LINKS.map((l, i) => (
        <Pressable key={l.label} onPress={() => router.push(l.href)}
            accessibilityRole="button"
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              minHeight: 56,
              paddingHorizontal: 16,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: t.border,
              backgroundColor: pressed ? t.muted : "transparent",
            })}
          >
            <Icon name={l.icon} size={20} color={t.tealText} />
            <Text variant="bodySemibold" style={{ flex: 1 }}>
              {l.label}
            </Text>
            <Icon name="chevronRight" size={16} color={t.mutedText} />
          </Pressable>
      ))}
    </Card>
  );
}

/** Whether cover requests can reach this phone, and how to fix it if not. */
function NotificationsRow() {
  const t = useTheme();
  const availability = pushAvailability();
  const [status, setStatus] = useState<Awaited<ReturnType<typeof pushPermission>>>(null);
  useEffect(() => {
    const read = () => pushPermission().then(setStatus);
    read();
    const sub = AppState.addEventListener("change", (s) => s === "active" && read());
    return () => sub.remove();
  }, []);
  const on = availability === "available" && status === "granted";
  const text =
    availability === "expoGo"
      ? "Expo Go on Android can't receive notifications. The Satisfy app build can."
      : availability === "simulator"
      ? "Notifications need a real phone. Simulators can't receive them."
      : availability === "unlinked"
        ? "This build isn't set up for notifications yet."
        : on
          ? "Cover requests and reminders come straight to this phone."
          : "Turn them on to hear about shifts that need cover.";
  return (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Icon name={on ? "bell" : "bellOff"} size={20} color={on ? t.greenText : t.mutedText} />
        <View style={{ flex: 1 }}>
          <Text variant="bodySemibold">Notifications {on ? "on" : "off"}</Text>
          <Text variant="small" tone="mutedText">
            {text}
          </Text>
        </View>
      </View>
      {availability === "available" && !on && (
        <Button
          label={status === "denied" ? "Open settings" : "Turn on notifications"}
          variant="outline"
          size="md"
          onPress={async () => {
            if (status === "denied") return Linking.openSettings();
            setStatus(await registerForPush({ ask: true }));
          }}
        />
      )}
    </Card>
  );
}

function toInput(me: Me): ProfileInput {
  return {
    phone: me.phone ?? "",
    suburb: me.suburb ?? "",
    emergencyName: me.emergencyName ?? "",
    emergencyPhone: me.emergencyPhone ?? "",
    availabilityNote: me.availabilityNote ?? "",
    lastMinuteOk: me.lastMinuteOk,
  };
}

function ProfileForm({ me }: { me: Me }) {
  const saved = toInput(me);
  const [draft, setDraft] = useState(saved);
  const save = useAction(actions.updateProfile);
  // Pick up server changes (e.g. after a save) unless the volunteer is editing.
  const savedKey = JSON.stringify(saved);
  const [lastSaved, setLastSaved] = useState(savedKey);
  if (savedKey !== lastSaved) {
    setLastSaved(savedKey);
    setDraft(saved);
  }
  const dirty = JSON.stringify(draft) !== savedKey;
  const set = (key: keyof ProfileInput) => (value: string) => setDraft((d) => ({ ...d, [key]: value }));

  return (
    <View style={{ gap: 20 }}>
      <FieldGroup title="Contact">
        <Field label="Email" value={me.email} editable={false} hint="Managed in Infoodle. Ask the coordinator to change it." />
        <Field label="Mobile" value={draft.phone} onChangeText={set("phone")} keyboardType="phone-pad" textContentType="telephoneNumber" autoComplete="tel" maxLength={30} />
        <Field label="Suburb or town" value={draft.suburb} onChangeText={set("suburb")} textContentType="addressCity" autoComplete="postal-address-locality" maxLength={60} />
      </FieldGroup>
      <FieldGroup title="Emergency contact">
        <Field label="Name and relationship" value={draft.emergencyName} onChangeText={set("emergencyName")} placeholder="e.g. Sam, partner" maxLength={80} />
        <Field label="Phone" value={draft.emergencyPhone} onChangeText={set("emergencyPhone")} keyboardType="phone-pad" maxLength={30} />
      </FieldGroup>
      <FieldGroup title="Availability">
        <Field label="When can you usually help?" value={draft.availabilityNote} onChangeText={set("availabilityNote")} placeholder="e.g. Most weekday mornings, not Fridays" multiline maxLength={300} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
          <View style={{ flex: 1 }}>
            <Text variant="bodySemibold">Send me last-minute cover requests</Text>
            <Text variant="small" tone="mutedText">
              Get a notification when a shift you can do needs cover at short notice.
            </Text>
          </View>
          <Host matchContents>
            <Switch value={draft.lastMinuteOk} onValueChange={(v) => setDraft((d) => ({ ...d, lastMinuteOk: v }))} />
          </Host>
        </View>
      </FieldGroup>
      <Button label="Save changes" icon="check" block disabled={!dirty} loading={save.isPending} onPress={() => save.mutate(draft)} />
    </View>
  );
}

function SignOut({ demo }: { demo: boolean }) {
  const { signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  return (
    <View style={{ gap: 8, paddingTop: 8 }}>
      <Button
        label={demo ? "Switch persona" : "Sign out"}
        icon="signOut"
        variant="outline"
        block
        loading={busy}
        onPress={async () => {
          setBusy(true);
          await signOut();
        }}
      />
      {demo && (
        <Text variant="caption" tone="mutedText" center>
          Demo only: returns to the persona picker.
        </Text>
      )}
    </View>
  );
}
