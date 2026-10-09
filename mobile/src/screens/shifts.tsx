import { useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";

import type { ShiftsWeek } from "@satisfy/core/api";
import { addDays, formatDayShort, formatMonth, WEEKDAY_LONG, weekdayOf, weekMonday } from "@satisfy/core/dates";
import { QueryScreen } from "@/components/screen";
import { ShiftCard } from "@/components/shift/shift-card";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { EmptyLine } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { useShiftsWeek } from "@/lib/queries";
import { radius, TAP, useTheme } from "@/theme";

export function ShiftsScreen() {
  const [monday, setMonday] = useState<string | null>(null);
  const query = useShiftsWeek(monday);
  return (
    <QueryScreen query={query}>
      {(week) => (
        <>
          <WeekSwitcher week={week} loading={query.isPlaceholderData} onChange={setMonday} />
          {week.days.map((day) => (
            <Day key={day.iso} day={day} today={week.today} />
          ))}
        </>
      )}
    </QueryScreen>
  );
}

function WeekSwitcher({ week, loading, onChange }: { week: ShiftsWeek; loading: boolean; onChange: (monday: string) => void }) {
  const t = useTheme();
  const thisWeek = weekMonday(week.today);
  const label = week.monday === thisWeek ? "This week" : week.monday === addDays(thisWeek, 7) ? "Next week" : formatMonth(week.monday);
  const arrow = (direction: -1 | 1) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={direction < 0 ? "Previous week" : "Next week"}
      onPress={() => onChange(addDays(week.monday, direction * 7))}
      style={({ pressed }) => ({ width: TAP + 4, height: TAP + 4, borderRadius: radius.lg, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? t.muted : "transparent" })}
    >
      <Icon name={direction < 0 ? "chevronLeft" : "chevronRight"} size={20} color={t.ink} />
    </Pressable>
  );
  return (
    <Card padded={false} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 4 }}>
      {arrow(-1)}
      <View style={{ alignItems: "center" }} accessibilityLiveRegion="polite">
        <Text variant="bodyBold" tabular>
          {formatDayShort(week.days[0].iso)} - {formatDayShort(week.days[4].iso)}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text variant="eyebrow" tone="mutedText" style={{ letterSpacing: 0.8 }}>
            {label}
          </Text>
          {loading && <ActivityIndicator size="small" color={t.mutedText} style={{ transform: [{ scale: 0.7 }] }} />}
        </View>
      </View>
      {arrow(1)}
    </Card>
  );
}

function Pill({ label, tone }: { label: string; tone: "today" | "away" }) {
  const t = useTheme();
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: tone === "today" ? t.primary : t.neutralTint }}>
      <Text variant="caption" tone={tone === "today" ? "white" : "neutral"} style={{ fontFamily: "Montserrat_700Bold" }}>
        {label}
      </Text>
    </View>
  );
}

function Day({ day, today }: { day: ShiftsWeek["days"][number]; today: string }) {
  const isToday = day.iso === today;
  return (
    <View style={{ gap: 10, opacity: day.iso < today ? 0.6 : 1 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text variant="heading" tone={isToday ? "tealText" : "ink"} accessibilityRole="header">
          {WEEKDAY_LONG[weekdayOf(day.iso)]}
        </Text>
        <Text variant="small" tone="mutedText" tabular>
          {formatDayShort(day.iso)}
        </Text>
        {isToday && <Pill label="Today" tone="today" />}
        {day.away && <Pill label="You're away" tone="away" />}
      </View>
      {day.shifts.length === 0 ? <EmptyLine text="No shifts scheduled." /> : day.shifts.map((s) => <ShiftCard key={s.id} shift={s} />)}
    </View>
  );
}
