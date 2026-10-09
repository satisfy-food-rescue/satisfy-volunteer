import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Text } from "@/components/ui/text";
import { actions, useAction } from "@/lib/queries";

/** Roles change which shifts and training apply, so volunteers ask and a
 *  coordinator makes the change. */
export function RoleRequestSheet() {
  const [message, setMessage] = useState("");
  const send = useAction(actions.requestRoleChange, { onSuccess: () => router.back() });
  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 24, gap: 16 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text variant="title" accessibilityRole="header">
          Change my roles
        </Text>
        <Button label="Cancel" variant="ghost" size="md" onPress={() => router.back()} />
      </View>
      <Field
        label="What would you like to change?"
        value={message}
        onChangeText={setMessage}
        placeholder="e.g. I'd like to try driver help on Fridays"
        multiline
        maxLength={500}
        autoFocus
        hint="The coordinator gets your message and will be in touch."
      />
      <Button label="Send request" icon="send" block disabled={message.trim().length < 3} loading={send.isPending} onPress={() => send.mutate(message.trim())} />
    </ScrollView>
  );
}
