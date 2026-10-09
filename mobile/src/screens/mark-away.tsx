import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import type { AwayInput } from "@satisfy/core/api";
import { formatDay } from "@satisfy/core/dates";
import type { AbsenceReason } from "@satisfy/core/domain";
import { DateField } from "@/components/date-field";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Icon, type IconName } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { plural } from "@/lib/format";
import { actions, useAction, useSession, useSlot } from "@/lib/queries";
import { radius, useTheme } from "@/theme";

const REASONS: { value: AbsenceReason; label: string; icon: IconName }[] = [
  { value: "HOLIDAY", label: "Holiday", icon: "holiday" },
  { value: "SICK", label: "Sick", icon: "sick" },
  { value: "OTHER", label: "Other", icon: "other" },
];

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function MarkAwaySheet() {
  const today = useSession().data?.today;
  const params = useLocalSearchParams<{ start?: string }>();
  if (!today) return null;
  const start = params.start && ISO.test(params.start) && params.start >= today ? params.start : today;
  return <MarkAwayForm today={today} initialStart={start} />;
}

function MarkAwayForm({ today, initialStart }: { today: string; initialStart: string }) {
  const t = useTheme();
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialStart);
  const [reason, setReason] = useState<AbsenceReason>("HOLIDAY");
  const [note, setNote] = useState("");
  const { data: slot } = useSlot();
  const markAway = useAction((input: AwayInput) => actions.markAway(input), { onSuccess: () => router.back() });
  const affected = useMemo(() => (slot?.upcoming ?? []).filter((u) => u.iso >= start && u.iso <= end), [slot, start, end]);
  const valid = end >= start && start >= today;

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 24, gap: 20 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text variant="title" accessibilityRole="header">
          Mark me away
        </Text>
        <Button label="Cancel" variant="ghost" size="md" onPress={() => router.back()} />
      </View>
      <Text variant="small" tone="mutedText" style={{ marginTop: -12 }}>
        Your shifts in these dates are released so someone else can cover. Your slot picks up again when you are back.
      </Text>

      <View style={{ flexDirection: "row", gap: 12 }}>
        <DateField
          label="From"
          value={start}
          min={today}
          onChange={(v) => {
            setStart(v);
            if (v > end) setEnd(v);
          }}
        />
        <DateField label="To" value={end} min={start} onChange={setEnd} />
      </View>

      <View style={{ gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel="Reason">
        <Text variant="bodySemibold">Reason</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {REASONS.map((r) => {
            const selected = reason === r.value;
            return (
              <Pressable
                key={r.value}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={r.label}
                onPress={() => setReason(r.value)}
                style={{
                  flex: 1,
                  minHeight: 64,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  borderRadius: radius.lg,
                  borderCurve: "continuous",
                  borderWidth: selected ? 2 : 1,
                  borderColor: selected ? t.primary : t.border,
                  backgroundColor: selected ? t.tealTint : t.card,
                }}
              >
                <Icon name={r.icon} size={20} color={selected ? t.tealDeep : t.ink} />
                <Text variant="smallBold" tone={selected ? "tealDeep" : "ink"}>
                  {r.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Field label="Note for the coordinator" optional value={note} onChangeText={setNote} placeholder="e.g. Back on the Monday" multiline maxLength={200} />

      <View style={{ padding: 14, borderRadius: radius.lg, borderCurve: "continuous", backgroundColor: affected.length ? t.orangeTint : t.muted, gap: 4 }} accessibilityLiveRegion="polite">
        {affected.length === 0 ? (
          <Text variant="small" tone="mutedText">
            No regular shifts fall in this range.
          </Text>
        ) : (
          <>
            <Text variant="smallBold" tone="orangeText">
              This releases {plural(affected.length, "shift", "shifts")} for cover:
            </Text>
            {affected.slice(0, 6).map((a) => (
              <Text key={a.iso + a.name} variant="small" tone="orangeText">
                {"•"} {formatDay(a.iso)}, {a.name}
              </Text>
            ))}
            {affected.length > 6 && (
              <Text variant="small" tone="orangeText">
                {"•"} and {affected.length - 6} more
              </Text>
            )}
          </>
        )}
      </View>

      <Button
        label="Mark me away"
        icon="calendarAway"
        block
        disabled={!valid}
        loading={markAway.isPending}
        onPress={() => markAway.mutate({ startDate: start, endDate: end, reason, note: note.trim() || undefined })}
      />
    </ScrollView>
  );
}
