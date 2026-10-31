import { router } from "expo-router";
import { Alert, ScrollView, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth";
import { actions, useAction } from "@/lib/queries";
import { useTheme } from "@/theme";

const CONSEQUENCES: { icon: IconName; text: string }[] = [
  { icon: "signOut", text: "You are signed out on every phone and browser, and your passkeys and connected accounts are removed." },
  { icon: "calendarAway", text: "You come off your regular slot and any upcoming shifts, and the coordinator is told you have left." },
  { icon: "person", text: "Your name, contact details, emergency contact and notes are removed straight away." },
  { icon: "shield", text: "The shifts and training you completed stay in Satisfy's records without your name." },
];

/** The volunteer closes their own account. The server does it at once, so
 *  the sheet explains first and asks twice. On success the token is already
 *  dead; forgetting it takes the app back to sign-in. */
export function DeleteAccountSheet() {
  const t = useTheme();
  const { forgetSession } = useAuth();
  const remove = useAction(actions.deleteAccount, {
    onSuccess: () => {
      router.back();
      void forgetSession();
    },
  });
  const confirm = () =>
    Alert.alert("Delete your account?", "This cannot be undone. To volunteer again, you would sign up afresh.", [
      { text: "Keep my account", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => remove.mutate() },
    ]);
  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 24, gap: 20 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text variant="title" accessibilityRole="header">
          Delete my account
        </Text>
        <Button label="Cancel" variant="ghost" size="md" onPress={() => router.back()} />
      </View>
      <Text variant="body" tone="mutedText">
        Stopping volunteering with Satisfy? Here is what deleting your account does.
      </Text>
      <View style={{ gap: 14 }}>
        {CONSEQUENCES.map((c) => (
          <View key={c.icon} style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
            <Icon name={c.icon} size={20} color={t.tealText} />
            <Text variant="body" style={{ flex: 1 }}>
              {c.text}
            </Text>
          </View>
        ))}
      </View>
      <Text variant="small" tone="mutedText">
        If you only need a break, Mark me away keeps your account and releases your shifts for the dates you choose.
      </Text>
      <Button label="Delete my account" icon="trash" variant="destructive" block loading={remove.isPending} onPress={confirm} />
    </ScrollView>
  );
}
