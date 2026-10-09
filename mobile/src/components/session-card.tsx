import { View } from "react-native";

import type { TrainingSessionItem } from "@satisfy/core/api";
import { actions, useAction } from "@/lib/queries";
import { useTheme } from "@/theme";

import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Icon } from "./ui/icon";
import { Text } from "./ui/text";

/** A training session with its RSVP, used on Training and on a module. */
export function SessionCard({ session }: { session: TrainingSessionItem }) {
  const t = useTheme();
  const rsvp = useAction(actions.rsvpSession);
  const busy = rsvp.isPending;
  return (
    <Card border={session.relevant ? "tealText" : "border"} style={{ gap: 6 }}>
      <Text variant="bodyBold">{session.moduleName}</Text>
      <Text variant="small" tone="inkSoft" tabular>
        {session.whenLabel}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 14, rowGap: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Icon name="pin" size={14} color={t.mutedText} />
          <Text variant="small" tone="mutedText">
            {session.location}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Icon name="people" size={14} color={t.mutedText} />
          <Text variant="small" tone="mutedText" tabular>
            {session.going} of {session.capacity} booked
          </Text>
        </View>
      </View>
      {!session.relevant && (
        <Text variant="small" tone="mutedText">
          Your record for this module is current; come along if you would like a refresher.
        </Text>
      )}
      <View style={{ marginTop: 8 }}>
        {session.mine === "GOING" ? (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Icon name="check" size={18} color={t.greenText} />
              <Text variant="bodySemibold" tone="greenText">
                You&apos;re booked in
              </Text>
            </View>
            <Button label="Can't make it" variant="ghost" size="md" loading={busy} onPress={() => rsvp.mutate({ id: session.id, going: false })} />
          </View>
        ) : (
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button
              label={session.full ? "Session full" : "I'll be there"}
              icon={session.full ? undefined : "check"}
              size="md"
              block
              disabled={session.full || busy}
              loading={busy && rsvp.variables?.going === true}
              onPress={() => rsvp.mutate({ id: session.id, going: true })}
            />
            {session.mine !== "DECLINED" && (
              <Button
                label="Can't"
                icon="close"
                variant="outline"
                size="md"
                disabled={busy}
                loading={busy && rsvp.variables?.going === false}
                onPress={() => rsvp.mutate({ id: session.id, going: false })}
              />
            )}
          </View>
        )}
      </View>
    </Card>
  );
}
