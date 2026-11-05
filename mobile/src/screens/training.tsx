import { router } from "expo-router";
import { Pressable, View } from "react-native";

import type { ModuleSummary, TrainingOverview } from "@satisfy/core/api";
import { formatDate, relativeDays } from "@satisfy/core/dates";
import { DELIVERY_LABEL } from "@satisfy/core/domain";
import { QueryScreen } from "@/components/screen";
import { SessionCard } from "@/components/session-card";
import { Card } from "@/components/ui/card";
import { Chip, TrainingChip } from "@/components/ui/chip";
import { Icon } from "@/components/ui/icon";
import { Section } from "@/components/ui/section";
import { EmptyLine } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { useTraining } from "@/lib/queries";
import { radius, useTheme, type Palette } from "@/theme";

export function TrainingScreen() {
  const query = useTraining();
  return (
    <QueryScreen query={query}>
      {(training) => (
        <>
          {!training.induction.complete && <InductionBanner toDo={training.induction.toDo} />}
          <Summary training={training} />
          <View style={{ gap: 10 }}>
            {training.required.map((m) => (
              <ModuleRow key={m.id} module={m} today={training.today} inductionComplete={training.induction.complete} />
            ))}
          </View>
          <Section title="Upcoming sessions">
            {training.sessions.length === 0 ? <EmptyLine text="No sessions scheduled right now." /> : training.sessions.map((s) => <SessionCard key={s.id} session={s} />)}
          </Section>
          {training.comingSoon.length > 0 && (
            <View style={{ gap: 8 }}>
              <Text variant="bodyBold" tone="mutedText" accessibilityRole="header">
                Coming soon
              </Text>
              {training.comingSoon.map((m) => (
                <ComingSoonRow key={m.id} module={m} />
              ))}
            </View>
          )}
          {training.notRequired.length > 0 && (
            <View style={{ gap: 8 }}>
              <Text variant="bodyBold" tone="mutedText" accessibilityRole="header">
                Not required for your roles
              </Text>
              {training.notRequired.map((m) => (
                <NotRequiredRow key={m.id} module={m} />
              ))}
            </View>
          )}
        </>
      )}
    </QueryScreen>
  );
}

/** Training opens once the induction is done, so it leads the screen until
 *  then. */
function InductionBanner({ toDo }: { toDo: string }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="Opens your induction"
      onPress={() => router.push("/induction")}
      style={({ pressed }) => ({
        flexDirection: "row",
        gap: 12,
        padding: 16,
        borderRadius: radius.card,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: pressed ? t.skyText : t.skyTint,
        backgroundColor: t.skyTint,
      })}
    >
      <View style={{ paddingTop: 2 }}>
        <Icon name="induction" size={22} color={t.skyText} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyBold">Start with your induction</Text>
        <Text variant="small" tone="inkSoft">
          Training opens once we have {toDo}.
        </Text>
      </View>
      <View style={{ paddingTop: 3 }}>
        <Icon name="chevronRight" size={16} color={t.skyText} />
      </View>
    </Pressable>
  );
}

const BAR: Record<string, keyof Palette | null> = { COMPLETE: "green", DUE_SOON: "orange", OVERDUE: "bad", NOT_STARTED: null };

function Summary({ training }: { training: TrainingOverview }) {
  const t = useTheme();
  const s = training.summary;
  const text = s.compliant
    ? s.dueSoon > 0
      ? `You can book any shift. ${s.dueSoon} refresher${s.dueSoon === 1 ? " is" : "s are"} due within 30 days.`
      : "All current. You can book any shift for your roles."
    : s.overdue > 0
      ? "Overdue modules block new bookings for the shifts that need them. Your regular slot keeps running."
      : "Complete the modules below before your first shift.";
  return (
    <Card border={s.compliant ? "green50" : "border"} background={s.compliant ? "greenTintSoft" : "card"} style={{ padding: 20 }}>
      <Text variant="display" tabular>
        {s.current}{" "}
        <Text variant="title" tone="mutedText">
          of {s.required}
        </Text>
      </Text>
      <Text variant="bodySemibold">modules current</Text>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={`${s.current} of ${s.required} modules current`}
        style={{ flexDirection: "row", height: 10, marginTop: 12, borderRadius: radius.pill, overflow: "hidden", backgroundColor: t.muted, gap: 2 }}
      >
        {training.required.map((m) => {
          const fill = BAR[m.status];
          return <View key={m.id} style={{ flex: 1, backgroundColor: fill ? t[fill] : "transparent" }} />;
        })}
      </View>
      <Text variant="small" tone="inkSoft" style={{ marginTop: 12 }}>
        {text}
      </Text>
    </Card>
  );
}

/** A date that never breaks across lines, so "18 August 2027" stays whole. */
function date(iso: string): string {
  return formatDate(iso).replace(/ /g, "\u00a0");
}

function statusLine(m: ModuleSummary, today: string): string {
  switch (m.status) {
    case "NOT_STARTED":
      return m.mandatoryBeforeFirstShift ? "Required before your first shift." : "Not yet completed.";
    case "COMPLETE":
      return m.expiresISO ? `Completed ${date(m.completedISO!)} · expires ${date(m.expiresISO)}` : `Completed ${date(m.completedISO!)} · does not expire`;
    case "DUE_SOON":
      return `Expires ${date(m.expiresISO!)} (${relativeDays(m.expiresISO!, today)})`;
    case "OVERDUE":
      return `Expired ${date(m.expiresISO!)} (${relativeDays(m.expiresISO!, today)})`;
    default:
      return "";
  }
}

function ModuleRow({ module: m, today, inductionComplete }: { module: ModuleSummary; today: string; inductionComplete: boolean }) {
  const t = useTheme();
  const online = m.delivery === "ONLINE_CONFIRM";
  const locked = m.status !== "COMPLETE" && m.lockedReason !== null;
  const actionable = m.status !== "COMPLETE" && !locked;
  const body = (pressed: boolean) => (
    <Card border={pressed ? "tealText" : "border"} style={{ gap: 8 }}>
      <View style={{ gap: 2 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", columnGap: 12, rowGap: 6 }}>
          <Text variant="bodyBold" style={{ flexShrink: 1 }}>
            {m.name}
          </Text>
          <TrainingChip status={m.status} small />
        </View>
        <Text variant="small" tone="mutedText">
          {m.validityMonths ? `Valid ${m.validityMonths} months` : "Once only"} · {DELIVERY_LABEL[m.delivery]}
        </Text>
      </View>
      <Text variant="small" tone="inkSoft" tabular>
        {statusLine(m, today)}
      </Text>
      {locked && (
        <View style={{ flexDirection: "row", gap: 6 }}>
          <View style={{ paddingTop: 3 }}>
            <Icon name="lock" size={14} color={t.mutedText} />
          </View>
          <Text variant="small" tone="mutedText" style={{ flex: 1 }}>
            {m.after && inductionComplete ? `Opens once ${m.after.name} is done.` : "Opens once your induction is done."}
          </Text>
        </View>
      )}
      {actionable && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Icon name={online ? "book" : "calendar"} size={15} color={t.tealText} />
          <Text variant="smallBold" tone="tealText">
            {online ? "Complete it online" : "Book a session"}
          </Text>
          <Icon name="chevronRight" size={13} color={t.tealText} />
        </View>
      )}
    </Card>
  );
  if (!actionable) return body(false);
  return (
    <Pressable onPress={() => router.push({ pathname: "/module/[code]", params: { code: m.code } })} accessibilityRole="button">{({ pressed }) => body(pressed)}</Pressable>
  );
}

/** A module still in development for the volunteer's roles: shown so they
 *  know it is on its way, never actionable. */
function ComingSoonRow({ module: m }: { module: ModuleSummary }) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: radius.lg,
        borderCurve: "continuous",
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: t.border,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="smallSemibold">{m.name}</Text>
        <Text variant="small" tone="mutedText">
          {m.description}
        </Text>
      </View>
      <Chip tone="neutral" icon="inDevelopment" label="In development" small />
    </View>
  );
}

function NotRequiredRow({ module: m }: { module: ModuleSummary }) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: radius.lg,
        borderCurve: "continuous",
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: t.border,
      }}
    >
      <Text variant="small" tone="mutedText" style={{ flex: 1 }}>
        {m.name}
      </Text>
      <TrainingChip status="NOT_REQUIRED" small />
    </View>
  );
}
