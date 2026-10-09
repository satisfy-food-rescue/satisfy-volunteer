import { router } from "expo-router";
import { Pressable, View } from "react-native";

import type { ShiftSummary } from "@satisfy/core/api";
import { formatDay, formatTimeRange, relativeDay } from "@satisfy/core/dates";
import { QueryScreen } from "@/components/screen";
import { KindTile } from "@/components/shift/kind-tile";
import { ShiftActions } from "@/components/shift/shift-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { EmptyState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { TAB } from "@/lib/links";
import { useCover } from "@/lib/queries";
import { useTheme } from "@/theme";

export function CoverScreen() {
  const query = useCover();
  return (
    <QueryScreen query={query}>
      {({ shifts, today }) => {
        const days = [...new Set(shifts.map((s) => s.iso))];
        return (
          <>
            <View style={{ gap: 4 }}>
              <Text variant="eyebrow" tone="tealText">
                Next four weeks
              </Text>
              <Text variant="body" tone="inkSoft">
                When someone is away, their shift shows up here. If you can step in, tap the button and it is yours.
              </Text>
            </View>
            {shifts.length === 0 ? (
              <EmptyState
                icon="sparkles"
                title="Everything is covered"
                text="No open gaps in the next four weeks. Check back after the weekend."
                action={<Button label="Browse all shifts" variant="outline" onPress={() => router.navigate(TAB.shifts)} />}
              />
            ) : (
              days.map((iso) => (
                <View key={iso} style={{ gap: 10 }}>
                  <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
                    <Text variant="heading" accessibilityRole="header">
                      {relativeDay(iso, today)}
                    </Text>
                    {relativeDay(iso, today) !== formatDay(iso) && (
                      <Text variant="small" tone="mutedText" tabular>
                        {formatDay(iso)}
                      </Text>
                    )}
                  </View>
                  {shifts
                    .filter((s) => s.iso === iso)
                    .map((s) => (
                      <GapCard key={s.id} shift={s} />
                    ))}
                </View>
              ))
            )}
            {shifts.some((s) => s.action.kind === "BLOCKED") && <LockedNote />}
          </>
        );
      }}
    </QueryScreen>
  );
}

function GapCard({ shift }: { shift: ShiftSummary }) {
  const t = useTheme();
  return (
    <Card border={shift.action.kind === "MINE" ? "green75" : "orange"} style={{ gap: 14 }}>
      <Pressable onPress={() => router.push({ pathname: "/shift/[id]", params: { id: shift.id } })} accessibilityRole="button" style={{ flexDirection: "row", gap: 12 }}>
          <KindTile kind={shift.kind} />
          <View style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text variant="bodyBold" style={{ flexShrink: 1 }}>
                {shift.name}
              </Text>
              <Icon name="chevronRight" size={14} color={t.mutedText} />
            </View>
            <Text variant="small" tone="mutedText" tabular>
              {formatTimeRange(shift.startTime, shift.endTime)} · {shift.location}
            </Text>
            <View style={{ flexDirection: "row", gap: 6, marginTop: 6 }}>
              <View style={{ paddingTop: 2 }}>
                <Icon name="cover" size={14} color={t.orangeText} />
              </View>
              <Text variant="smallSemibold" tone="orangeText" style={{ flex: 1 }}>
                Needs {shift.shortBy} more. {shift.causes[0]}.
              </Text>
            </View>
          </View>
        </Pressable>
      <ShiftActions shift={shift} compact />
    </Card>
  );
}

function LockedNote() {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      <View style={{ paddingTop: 2 }}>
        <Icon name="lock" size={14} color={t.mutedText} />
      </View>
      <Text variant="small" tone="mutedText" style={{ flex: 1 }}>
        Locked shifts open up as soon as the training they need is current.
      </Text>
    </View>
  );
}
