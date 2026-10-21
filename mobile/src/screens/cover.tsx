import { router } from "expo-router";
import { Pressable, View } from "react-native";

import type { ShiftSummary } from "@satisfy/core/api";
import { formatDay, formatTimeRange, relativeDay } from "@satisfy/core/dates";
import { QueryScreen } from "@/components/screen";
import { KindTile } from "@/components/shift/kind-tile";
import { LockBanner, locksOf, unlockNote, type Lock } from "@/components/shift/lock-banner";
import { ShiftActions } from "@/components/shift/shift-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Icon } from "@/components/ui/icon";
import { EmptyState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { TAB } from "@/lib/links";
import { useCover } from "@/lib/queries";
import { radius, useTheme } from "@/theme";

export function CoverScreen() {
  const query = useCover();
  return (
    <QueryScreen query={query}>
      {({ shifts, today }) => {
        // The shifts I can take come first; the locked ones follow, compact,
        // with why they are locked said once at the top.
        const open = shifts.filter((s) => s.action.kind !== "BLOCKED");
        const locked = shifts.filter((s) => s.action.kind === "BLOCKED");
        const locks = locksOf(locked);
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
                text="No open gaps in the next four weeks. Check back soon."
                action={<Button label="Browse all shifts" variant="outline" onPress={() => router.navigate(TAB.shifts)} />}
              />
            ) : (
              <>
                {locks.length > 0 && <LockBanner locks={locks} />}
                {[...new Set(open.map((s) => s.iso))].map((iso) => (
                  <View key={iso} style={{ gap: 10 }}>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", columnGap: 8 }}>
                      <Text variant="heading" accessibilityRole="header">
                        {relativeDay(iso, today)}
                      </Text>
                      {relativeDay(iso, today) !== formatDay(iso) && (
                        <Text variant="small" tone="mutedText" tabular>
                          {formatDay(iso)}
                        </Text>
                      )}
                    </View>
                    {open
                      .filter((s) => s.iso === iso)
                      .map((s) => (
                        <GapCard key={s.id} shift={s} />
                      ))}
                  </View>
                ))}
                {locked.length > 0 && <Locked shifts={locked} locks={locks} today={today} />}
              </>
            )}
          </>
        );
      }}
    </QueryScreen>
  );
}

function GapCard({ shift }: { shift: ShiftSummary }) {
  const t = useTheme();
  const when = formatTimeRange(shift.startTime, shift.endTime);
  const need = `Needs ${shift.shortBy} more. ${shift.causes[0]}.`;
  return (
    <Card border={shift.action.kind === "MINE" ? "green75" : "orange"} style={{ gap: 14 }}>
      <Pressable
        onPress={() => router.push({ pathname: "/shift/[id]", params: { id: shift.id } })}
        accessibilityRole="button"
        accessibilityLabel={`${shift.name}, ${when}, ${shift.location}. ${need}`}
        style={{ flexDirection: "row", gap: 12 }}
      >
        <KindTile kind={shift.kind} />
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
            <Text variant="bodyBold" style={{ flex: 1 }}>
              {shift.name}
            </Text>
            <View style={{ paddingTop: 3 }}>
              <Icon name="chevronRight" size={16} color={t.mutedText} />
            </View>
          </View>
          <Text variant="small" tone="mutedText" tabular>
            {when} · {shift.location}
          </Text>
          <View style={{ flexDirection: "row", gap: 6, marginTop: 6 }}>
            <View style={{ paddingTop: 2 }}>
              <Icon name="cover" size={14} color={t.orangeText} />
            </View>
            <Text variant="smallSemibold" tone="orangeText" style={{ flex: 1 }}>
              {need}
            </Text>
          </View>
        </View>
      </Pressable>
      <ShiftActions shift={shift} compact />
    </Card>
  );
}

function Locked({ shifts, locks, today }: { shifts: ShiftSummary[]; locks: Lock[]; today: string }) {
  return (
    <View style={{ gap: 10 }}>
      <View style={{ gap: 2 }}>
        <Text variant="heading" accessibilityRole="header">
          Locked for you
        </Text>
        <Text variant="small" tone="mutedText">
          {unlockNote(locks)}
        </Text>
      </View>
      {shifts.map((s) => (
        <LockedCard key={s.id} shift={s} today={today} />
      ))}
    </View>
  );
}

/** A gap I can't take yet: what and when, and a grey lock saying why. */
function LockedCard({ shift, today }: { shift: ShiftSummary; today: string }) {
  const t = useTheme();
  const a = shift.action;
  const lock = a.kind !== "BLOCKED" ? null : a.fix === "harvestPool" ? "Join the pool" : a.fix === "role" ? "Role needed" : "Training needed";
  const when = `${relativeDay(shift.iso, today)}, ${formatTimeRange(shift.startTime, shift.endTime)}`;
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/shift/[id]", params: { id: shift.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${shift.name}, ${when}, needs cover, ${lock}`}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: radius.xl,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: t.border,
        backgroundColor: pressed ? t.cardSunk : t.card,
      })}
    >
      <KindTile kind={shift.kind} size={36} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text variant="bodySemibold">{shift.name}</Text>
        <Text variant="small" tone="mutedText" tabular>
          {when}
        </Text>
        {lock && <Chip tone="neutral" icon="lock" small label={lock} />}
      </View>
      <Icon name="chevronRight" size={16} color={t.mutedText} />
    </Pressable>
  );
}
