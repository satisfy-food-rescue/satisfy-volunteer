import { router } from "expo-router";
import { Alert, Pressable, View } from "react-native";

import type { SlotOverview } from "@satisfy/core/api";
import { formatDayRange, formatTimeRange, WEEKDAY_LONG } from "@satisfy/core/dates";
import { ABSENCE_REASON_LABEL } from "@satisfy/core/domain";
import { QueryScreen } from "@/components/screen";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Icon } from "@/components/ui/icon";
import { Section } from "@/components/ui/section";
import { EmptyLine, EmptyState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { plural } from "@/lib/format";
import { TAB } from "@/lib/links";
import { actions, useAction, useSlot } from "@/lib/queries";
import { radius, TAP, useTheme } from "@/theme";

export function SlotScreen() {
  const query = useSlot();
  return (
    <QueryScreen query={query}>
      {(slot) => (
        <>
          <Text variant="eyebrow" tone="tealText">
            Recurring commitment
          </Text>
          <Slots slots={slot.slots} />
          <Card style={{ padding: 20, gap: 8 }}>
            <Text variant="title">Mark me away</Text>
            <Text variant="small" tone="mutedText">
              Holiday or sick? Tell us the dates and your shifts are released so someone else can cover. Your slot picks up again when you are back.
            </Text>
            <View style={{ marginTop: 8, flexDirection: "row" }}>
              <Button label="Mark me away" icon="calendarAway" block onPress={() => router.push("/mark-away")} />
            </View>
          </Card>
          <Section title="Upcoming absences">
            {slot.absences.length === 0 ? <EmptyLine text="None planned. Ka pai." /> : slot.absences.map((a) => <AbsenceRow key={a.id} absence={a} />)}
          </Section>
        </>
      )}
    </QueryScreen>
  );
}

function Slots({ slots }: { slots: SlotOverview["slots"] }) {
  const t = useTheme();
  if (slots.length === 0) {
    return (
      <EmptyState
        icon="calendarCheck"
        title="No regular slot yet"
        text="Most volunteers hold a weekly slot. Once your training is done, talk to the coordinator or book a few one-off shifts to find a morning that suits."
        action={<Button label="Browse shifts" variant="outline" onPress={() => router.navigate(TAB.shifts)} />}
      />
    );
  }
  return (
    <View style={{ gap: 10 }}>
      {slots.map((s) => (
        <Card key={s.id} border="tealTint" background="tealTintSoft" style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
          <View style={{ width: 48, height: 48, borderRadius: radius.md, borderCurve: "continuous", backgroundColor: t.card, alignItems: "center", justifyContent: "center" }}>
            <Icon name="calendarCheck" size={24} color={t.tealText} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="title">{WEEKDAY_LONG[s.weekday]}s</Text>
            <Text variant="body">{s.name}</Text>
            <Text variant="small" tone="inkSoft" tabular>
              {formatTimeRange(s.startTime, s.endTime)}
            </Text>
          </View>
        </Card>
      ))}
    </View>
  );
}

function AbsenceRow({ absence: a }: { absence: SlotOverview["absences"][number] }) {
  const t = useTheme();
  const remove = useAction(actions.removeAbsence);
  return (
    <Card style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
      <View style={{ flex: 1, gap: 6 }}>
        <Text variant="bodyBold">{formatDayRange(a.startISO, a.endISO)}</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <Chip tone="neutral" small label={ABSENCE_REASON_LABEL[a.reason]} />
          {a.note && (
            <Text variant="small" tone="mutedText">
              {a.note}
            </Text>
          )}
        </View>
        <Text variant="small" tone="inkSoft">
          {a.releasedCount === 0 ? "No regular shifts affected." : `${plural(a.releasedCount, "shift", "shifts")} released for cover.`}
        </Text>
      </View>
      {a.removable && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Remove absence"
          disabled={remove.isPending}
          onPress={() =>
            Alert.alert("Remove this absence?", "Your shifts go back on where nobody has covered them yet.", [
              { text: "Keep it", style: "cancel" },
              { text: "Remove", style: "destructive", onPress: () => remove.mutate(a.id) },
            ])
          }
          style={({ pressed }) => ({ width: TAP, height: TAP, borderRadius: TAP / 2, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? t.badTint : "transparent", opacity: remove.isPending ? 0.4 : 1 })}
        >
          <Icon name="trash" size={20} color={t.mutedText} />
        </Pressable>
      )}
    </Card>
  );
}
