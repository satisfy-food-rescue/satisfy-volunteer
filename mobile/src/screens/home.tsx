import { useIsFocused } from "expo-router/react-navigation";
import { router, type Href } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { Home, HomeAlert, ShiftSummary } from "@satisfy/core/api";
import { formatDay, formatDayLong, formatTimeRange, relativeDays, todayISO } from "@satisfy/core/dates";
import { BrandWaves, FoodIcon, Logo, type FoodKind } from "@/components/brand/logo";
import { Photo, shiftPhoto } from "@/components/photo";
import { usePullToRefresh } from "@/components/screen";
import { StatusBarScrim } from "@/components/status-bar-scrim";
import { CrewLine } from "@/components/shift/crew-line";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon, type IconName } from "@/components/ui/icon";
import { ErrorState, InlineError, LoadingState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { compactCount, formatCount, greeting, plural } from "@/lib/format";
import { TAB } from "@/lib/links";
import { useHome, useRefreshOnFocus, useSession } from "@/lib/queries";
import { font, radius, useTheme, type Palette } from "@/theme";

export function HomeScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const home = useHome();
  const { data: session } = useSession();
  const pull = usePullToRefresh(home.refetch);
  useRefreshOnFocus(home.refetch);
  const me = session?.me;
  // On iOS the status bar blurs whatever scrolls under it. Its text is white
  // on the teal hero and turns dark once light content is behind it. At rest
  // the scroll view is inset by the status bar height, so its offset is
  // -insets.top.
  const [heroBottom, setHeroBottom] = useState(0);
  const [under, setUnder] = useState(false);
  const [pastHero, setPastHero] = useState(false);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (process.env.EXPO_OS !== "ios") return;
    const y = e.nativeEvent.contentOffset.y + insets.top;
    if (y > 2 !== under) setUnder(y > 2);
    if (y > heroBottom !== pastHero) setPastHero(y > heroBottom);
  };

  return (
    <>
      {focused && <StatusBar style={pastHero ? "auto" : "light"} />}
      {/* On iOS the native tabs inset the first scroll view below the status
          bar and above the tab bar themselves, so the hero only adds the
          status bar height on Android. */}
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: t.background }}
        contentContainerStyle={{ paddingBottom: 32 }}
        onScroll={onScroll}
        scrollEventThrottle={32}
        refreshControl={<RefreshControl {...pull} tintColor={t.white} colors={[t.teal]} progressViewOffset={insets.top} />}
      >
        {/* Keeps the teal band behind the status bar when pulling down. */}
        <View style={{ position: "absolute", top: -1000, left: 0, right: 0, height: 1000, backgroundColor: t.hero }} />
        <View
          onLayout={(e) => setHeroBottom(e.nativeEvent.layout.y + e.nativeEvent.layout.height)}
          style={{ backgroundColor: t.hero, paddingTop: process.env.EXPO_OS === "ios" ? 8 : insets.top + 8, paddingHorizontal: 20, paddingBottom: 68 }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Logo height={52} color={t.white} />
            {me && (
              <Pressable onPress={() => router.navigate(TAB.me)} accessibilityRole="button" accessibilityLabel="My profile" hitSlop={8}>
                  <Avatar person={me} ring="white" />
                </Pressable>
            )}
          </View>
          <Text variant="eyebrow" tone="tealOn" style={{ marginTop: 20 }}>
            {formatDayLong(home.data?.today ?? session?.today ?? todayISO())}
          </Text>
          <Text variant="hero" tone="white" style={{ marginTop: 6 }} accessibilityRole="header">
            {greeting()}
            {me ? `, ${me.firstName}.` : "."}
          </Text>
        </View>

        <View style={{ marginTop: -44, paddingHorizontal: 20, gap: 20 }}>
          {home.data === undefined ? (
            <Card raised>{home.error ? <ErrorState message={home.error.message} onRetry={() => home.refetch()} /> : <LoadingState />}</Card>
          ) : (
            <HomeContent home={home.data} />
          )}
          {home.data && home.error && <InlineError message={home.error.message} onRetry={() => home.refetch()} />}
        </View>
        <View style={{ marginTop: 28, flexDirection: "row", alignItems: "center", gap: 14, paddingRight: 20 }}>
          <View style={{ flex: 1 }}>
            <BrandWaves height={40} />
          </View>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {(["broccoli", "carrot", "apple"] as const).map((k) => (
              <FoodIcon key={k} kind={k} size={28} />
            ))}
          </View>
        </View>
      </ScrollView>
      <StatusBarScrim active={under} />
    </>
  );
}

function HomeContent({ home }: { home: Home }) {
  return (
    <>
      {home.next ? <NextShift shift={home.next} today={home.today} /> : <NoShift home={home} />}
      {home.alert && <TrainingAlert alert={home.alert} />}
      <QuickActions />
      {home.cover.count > 0 && <CoverCard cover={home.cover} />}
      {home.harvest && <HarvestCard harvest={home.harvest} />}
      <Impact impact={home.impact} />
    </>
  );
}

function NextShift({ shift, today }: { shift: ShiftSummary; today: string }) {
  const t = useTheme();
  // No hairline border: it would outline the photo against the teal band, so
  // the shadow defines the card and a press dims it.
  return (
    <Pressable onPress={() => router.push({ pathname: "/shift/[id]", params: { id: shift.id } })} accessibilityRole="button" accessibilityLabel={`Next shift ${formatDay(shift.iso)}, ${shift.name}`}>
        {({ pressed }) => (
          <Card raised padded={false} style={{ borderWidth: 0, opacity: pressed ? 0.85 : 1 }}>
            <Photo photo={shiftPhoto(shift.kind)} decorative style={{ height: 144 }} />
            <View style={{ padding: 20 }}>
              <Text variant="eyebrow" tone="tealText">
                Next shift · {relativeDays(shift.iso, today)}
              </Text>
              <Text variant="display" style={{ marginTop: 6 }}>
                {formatDay(shift.iso)}
              </Text>
              <Text variant="heading" tone="inkSoft" tabular style={{ fontFamily: font.medium }}>
                {formatTimeRange(shift.startTime, shift.endTime)}
              </Text>
            </View>
            <View style={{ backgroundColor: t.tealTintSoft, borderTopWidth: 1, borderTopColor: t.border, paddingHorizontal: 20, paddingVertical: 16, gap: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="bodyBold">{shift.name}</Text>
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    <View style={{ paddingTop: 3 }}>
                      <Icon name="pin" size={14} color={t.lightBlue} />
                    </View>
                    <Text variant="small" tone="inkSoft" style={{ flexShrink: 1 }}>
                      {shift.location}
                    </Text>
                  </View>
                </View>
                <Icon name="arrowRight" size={18} color={t.tealText} />
              </View>
              <CrewLine crew={shift.crew} ring="tealTintSoft" />
            </View>
          </Card>
        )}
      </Pressable>
  );
}

function NoShift({ home }: { home: Home }) {
  return (
    <Card raised style={{ padding: 20, gap: 6 }}>
      <Text variant="eyebrow" tone="tealText">
        Next shift
      </Text>
      <Text variant="title">No shifts booked yet</Text>
      <Text variant="small" tone="mutedText">
        {home.empty.text}
      </Text>
      <View style={{ marginTop: 10, flexDirection: "row" }}>
        <Button label={home.empty.cta} block onPress={() => router.navigate(home.empty.target === "training" ? TAB.training : TAB.shifts)} />
      </View>
    </Card>
  );
}

const ALERT_TONE: Record<HomeAlert["tone"], { bg: keyof Palette; fg: keyof Palette; icon: IconName }> = {
  bad: { bg: "badTint", fg: "bad", icon: "alert" },
  warn: { bg: "orangeTint", fg: "orangeText", icon: "alert" },
  info: { bg: "skyTint", fg: "skyText", icon: "training" },
};

function TrainingAlert({ alert }: { alert: HomeAlert }) {
  const t = useTheme();
  const c = ALERT_TONE[alert.tone];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="Opens your training"
      onPress={() => router.navigate(TAB.training)}
      style={({ pressed }) => ({
        flexDirection: "row",
        gap: 12,
        padding: 16,
        borderRadius: radius.card,
        borderCurve: "continuous",
        backgroundColor: t[c.bg],
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View style={{ paddingTop: 2 }}>
        <Icon name={c.icon} size={22} color={t[c.fg]} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyBold" tone={c.fg}>
          {alert.title}
        </Text>
        <Text variant="small" tone={c.fg}>
          {alert.text}
        </Text>
      </View>
      <View style={{ paddingTop: 3 }}>
        <Icon name="arrowRight" size={18} color={t[c.fg]} />
      </View>
    </Pressable>
  );
}

const QUICK: { label: string; icon: IconName; href: Href }[] = [
  { label: "Book a shift", icon: "calendar", href: TAB.shifts },
  { label: "Mark me away", icon: "calendarAway", href: "/mark-away" },
  { label: "My training", icon: "training", href: TAB.training },
];

function QuickActions() {
  const t = useTheme();
  // Three tiles side by side fit their labels up to about 130% text. Larger
  // text stacks them as full-width rows so no label breaks mid-phrase.
  const stacked = useWindowDimensions().fontScale > 1.3;
  return (
    <View style={{ flexDirection: stacked ? "column" : "row", gap: 10 }} accessibilityLabel="Quick actions">
      {QUICK.map((q) => (
        <Pressable
          key={q.label}
          accessibilityRole="button"
          onPress={() => router.navigate(q.href)}
          style={({ pressed }) => ({
            flex: stacked ? undefined : 1,
            minHeight: stacked ? 64 : 104,
            flexDirection: stacked ? "row" : "column",
            alignItems: "center",
            gap: stacked ? 14 : 10,
            paddingTop: stacked ? 10 : 16,
            paddingBottom: stacked ? 10 : 12,
            paddingHorizontal: stacked ? 14 : 6,
            borderRadius: radius.card,
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: pressed ? t.tealText : t.border,
            backgroundColor: t.card,
          })}
        >
          {({ pressed }) => (
            <>
              <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? t.primary : t.tealTint }}>
                <Icon name={q.icon} size={20} color={pressed ? t.white : t.tealText} />
              </View>
              <Text variant={stacked ? "bodyBold" : "smallBold"} center={!stacked} style={stacked && { flex: 1 }}>
                {q.label}
              </Text>
              {stacked && <Icon name="chevronRight" size={16} color={t.mutedText} />}
            </>
          )}
        </Pressable>
      ))}
    </View>
  );
}

function CoverCard({ cover }: { cover: Home["cover"] }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.navigate(TAB.cover)}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 16,
        borderRadius: radius.card,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: t.orange,
        backgroundColor: pressed ? t.orangeTint : t.card,
      })}
    >
      <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: t.orange }}>
        <Icon name="cover" size={20} color={t.onOrange} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyBold">{cover.count === 1 ? "1 shift needs cover" : `${cover.count} shifts need cover`}</Text>
        {cover.next && (
          <Text variant="small" tone="mutedText">
            Next: {formatDay(cover.next.iso)}, {cover.next.name}
          </Text>
        )}
      </View>
      <Icon name="arrowRight" size={18} color={t.orangeText} />
    </Pressable>
  );
}

function HarvestCard({ harvest }: { harvest: NonNullable<Home["harvest"]> }) {
  const t = useTheme();
  return (
    <Pressable onPress={() => router.push({ pathname: "/shift/[id]", params: { id: harvest.id } })}
        accessibilityRole="button"
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          padding: 16,
          borderRadius: radius.card,
          borderCurve: "continuous",
          borderWidth: 1,
          borderColor: pressed ? t.tealText : t.border,
          backgroundColor: t.card,
        })}
      >
        <FoodIcon kind="apple" size={44} />
        <View style={{ flex: 1 }}>
          <Text variant="bodyBold">Harvest: {harvest.title}</Text>
          <Text variant="small" tone="mutedText">
            {formatDay(harvest.iso)}
            {harvest.going ? " · You're going" : " · Tap to sign up"}
          </Text>
        </View>
        <Icon name="arrowRight" size={18} color={t.mutedText} />
      </Pressable>
  );
}

function Impact({ impact }: { impact: Home["impact"] }) {
  const t = useTheme();
  const stats: [FoodKind, string, string][] = [
    ["broccoli", compactCount(impact.kgRescued), "kg of kai rescued"],
    ["carrot", compactCount(impact.meals), "meals shared"],
    ["apple", `${formatCount(impact.co2Tonnes)} t`, `CO₂e avoided in ${impact.co2Period}`],
  ];
  return (
    <View accessibilityLabel="Impact" style={{ backgroundColor: t.hero, borderRadius: radius.card, borderCurve: "continuous", padding: 20 }}>
      <Text variant="eyebrow" tone="tealOn">
        Together, over {plural(impact.yearsRunning, "year", "years")}
      </Text>
      <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
        {stats.map(([icon, n, label]) => (
          <View key={label} style={{ flex: 1 }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: "rgba(255,255,255,0.8)", alignItems: "center", justifyContent: "center" }}>
              <FoodIcon kind={icon} size={36} />
            </View>
            <Text variant="title" tone="white" tabular numberOfLines={1} adjustsFontSizeToFit style={{ marginTop: 10 }}>
              {n}
            </Text>
            <Text variant="caption" tone="white" style={{ opacity: 0.85, marginTop: 2 }}>
              {label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
