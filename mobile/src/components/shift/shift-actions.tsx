import { router } from "expo-router";
import { Alert, View } from "react-native";

import type { ShiftSummary } from "@satisfy/core/api";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { TAB } from "@/lib/links";
import { actions, useAction } from "@/lib/queries";
import { radius, useTheme } from "@/theme";

/** What I can do with a shift. The server decides which case applies, using
 *  the same booking rules as the web app. */
export function ShiftActions({ shift, compact = false }: { shift: ShiftSummary; compact?: boolean }) {
  const t = useTheme();
  const book = useAction(actions.book);
  const cancel = useAction(actions.cancel);
  const a = shift.action;

  switch (a.kind) {
    case "PAST":
      return null;
    case "CANCELLED":
      return (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Icon name="cancelled" size={20} color={t.neutral} />
          <Text variant="bodySemibold" tone="neutral">
            This shift has been cancelled.
          </Text>
        </View>
      );
    case "MINE":
      return (
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Icon name="checkCircle" size={20} color={t.greenText} />
            <Text variant="bodySemibold" tone="greenText">
              {a.source === "REGULAR" ? "This is your regular slot" : a.source === "COVER" ? "You're covering this shift" : "You're booked on"}
            </Text>
          </View>
          {!compact &&
            (a.source === "REGULAR" ? (
              <Button
                label="Going to be away? Mark me away"
                variant="outline"
                block
                onPress={() => router.push({ pathname: "/mark-away", params: { start: shift.iso } })}
              />
            ) : (
              <Button
                label="Cancel my booking"
                variant="outline"
                block
                loading={cancel.isPending}
                onPress={() =>
                  Alert.alert("Cancel this booking?", "The shift goes back on the roster for someone else.", [
                    { text: "Keep it", style: "cancel" },
                    { text: "Cancel booking", style: "destructive", onPress: () => cancel.mutate(a.assignmentId) },
                  ])
                }
              />
            ))}
        </View>
      );
    case "BLOCKED":
      return (
        <View style={{ gap: 12, padding: 16, borderRadius: radius.xl, borderCurve: "continuous", backgroundColor: t.orangeTint }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ paddingTop: 2 }}>
              <Icon name="lock" size={18} color={t.orangeText} />
            </View>
            <Text variant="bodySemibold" tone="orangeText" style={{ flex: 1 }}>
              {a.reason}
            </Text>
          </View>
          {a.fix === "role" ? (
            <Button label="Ask to change my roles" variant="outline" block onPress={() => router.push("/role-request")} />
          ) : (
            <Button
              label="Go to training"
              variant="outline"
              block
              onPress={() => router.push(a.moduleCode ? { pathname: "/module/[code]", params: { code: a.moduleCode } } : TAB.training)}
            />
          )}
        </View>
      );
    case "FULL":
      return (
        <Text variant="bodySemibold" tone="mutedText">
          This shift is full.
        </Text>
      );
    case "BOOK":
      return (
        <Button
          label={a.cover ? "I can cover this" : "Book this shift"}
          icon={a.cover ? "cover" : undefined}
          variant={a.cover ? "cover" : "primary"}
          block
          loading={book.isPending}
          onPress={() => book.mutate(shift.id)}
        />
      );
  }
}
