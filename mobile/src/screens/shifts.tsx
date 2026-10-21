import { useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";

import type { ShiftsWeek } from "@satisfy/core/api";
import { addDays, formatDayShort, formatMonth, WEEKDAY_LONG, weekdayOf, weekMonday } from "@satisfy/core/dates";
import { QueryScreen } from "@/components/screen";
import { LockBanner, locksOf } from "@/components/shift/lock-banner";
import { ShiftCard } from "@/components/shift/shift-card";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Icon } from "@/components/ui/icon";
import { EmptyLine } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { useShiftsWeek } from "@/lib/queries";
import { radius, TAP, useTheme } from "@/theme";

type WeekDay = ShiftsWeek["days"][number];

export function ShiftsScreen() {
  const [monday, setMonday] = useState<string | null>(null);
  const query = useShiftsWeek(monday);
  return (
    <QueryScreen query={query}>
      {(week) => {
        // Why some shifts are locked is said once, above the days, for days
        // still to come.
        const locks = locksOf(week.days.filter((d) => d.iso >= week.today).flatMap((d) => d.shifts));
        // In the current week the days gone by fold away so the week opens on
        // today, as on the web on a phone. An old week shows every day.
        const earlier = week.monday === weekMonday(week.today) ? week.days.filter((d) => d.iso < week.today) : [];
        return (
          <>
            <WeekSwitcher week={week} loading={query.isPlaceholderData} onChange={setMonday} />
            {locks.length > 0 && <LockBanner locks={locks} />}
            {earlier.length > 0 && <Earlier key={week.monday} days={earlier} today={week.today} />}
            {week.days.slice(earlier.length).map((day) => (
              <Day key={day.iso} day={day} today={week.today} />
            ))}
          </>
        );
      }}
    </QueryScreen>
  );
}

function Earlier({ days, today }: { days: WeekDay[]; today: string }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const label = `Earlier this week (${days.length} ${days.length === 1 ? "day" : "days"})`;
  return (
    <Card padded={false} background="cardSunk">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        style={({ pressed }) => ({ minHeight: 52, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, backgroundColor: pressed ? t.muted : "transparent" })}
      >
        <Text variant="bodySemibold" tone="inkSoft" style={{ flex: 1 }}>
          {label}
        </Text>
        <View style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}>
          <Icon name="chevronDown" size={16} color={t.inkSoft} />
        </View>
      </Pressable>
      {open && (
        <View style={{ gap: 20, paddingHorizontal: 12, paddingTop: 4, paddingBottom: 16 }}>
          {days.map((day) => (
            <Day key={day.iso} day={day} today={today} />
          ))}
        </View>
      )}
    </Card>
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

function TodayPill() {
  const t = useTheme();
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: t.primary }}>
      <Text variant="labelBold" tone="white">
        Today
      </Text>
    </View>
  );
}

function Day({ day, today }: { day: WeekDay; today: string }) {
  const isToday = day.iso === today;
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 8, rowGap: 4 }}>
        <Text variant="heading" tone={isToday ? "tealText" : day.iso < today ? "mutedText" : "ink"} accessibilityRole="header">
          {WEEKDAY_LONG[weekdayOf(day.iso)]}
        </Text>
        <Text variant="small" tone="mutedText" tabular>
          {formatDayShort(day.iso)}
        </Text>
        {isToday && <TodayPill />}
        {day.away && <Chip tone="neutral" icon="calendarAway" small label="You're away" />}
      </View>
      {day.shifts.length === 0 ? <EmptyLine text="No shifts scheduled." /> : day.shifts.map((s) => <ShiftCard key={s.id} shift={s} hideReason />)}
    </View>
  );
}
