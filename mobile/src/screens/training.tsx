import { router } from "expo-router";
import { Pressable, View } from "react-native";

import type { ModuleSummary, TrainingOverview } from "@satisfy/core/api";
import { formatDate, relativeDays } from "@satisfy/core/dates";
import { DELIVERY_LABEL } from "@satisfy/core/domain";
import { QueryScreen } from "@/components/screen";
import { SessionCard } from "@/components/session-card";
import { Card } from "@/components/ui/card";
import { TrainingChip } from "@/components/ui/chip";
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
          <Summary training={training} />
          <View style={{ gap: 10 }}>
            {training.required.map((m) => (
              <ModuleRow key={m.id} module={m} today={training.today} />
            ))}
          </View>
          <Section title="Upcoming sessions">
            {training.sessions.length === 0 ? <EmptyLine text="No sessions scheduled right now." /> : training.sessions.map((s) => <SessionCard key={s.id} session={s} />)}
          </Section>
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

function statusLine(m: ModuleSummary, today: string): string {
  switch (m.status) {
    case "NOT_STARTED":
      return m.mandatoryBeforeFirstShift ? "Required before your first shift." : "Not yet completed.";
    case "COMPLETE":
      return m.expiresISO ? `Completed ${formatDate(m.completedISO!)} · expires ${formatDate(m.expiresISO)}` : `Completed ${formatDate(m.completedISO!)} · does not expire`;
    case "DUE_SOON":
      return `Expires ${formatDate(m.expiresISO!)} (${relativeDays(m.expiresISO!, today)})`;
    case "OVERDUE":
      return `Expired ${formatDate(m.expiresISO!)} (${relativeDays(m.expiresISO!, today)})`;
    default:
      return "";
  }
}

function ModuleRow({ module: m, today }: { module: ModuleSummary; today: string }) {
  const t = useTheme();
  const online = m.delivery === "ONLINE_CONFIRM";
  const actionable = m.status !== "COMPLETE";
  const body = (pressed: boolean) => (
    <Card border={pressed ? "tealText" : "border"} style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text variant="bodyBold">{m.name}</Text>
          <Text variant="small" tone="mutedText">
            {m.validityMonths ? `Valid ${m.validityMonths} months` : "Once only"} · {DELIVERY_LABEL[m.delivery]}
          </Text>
        </View>
        <TrainingChip status={m.status} small />
      </View>
      <Text variant="small" tone="inkSoft" tabular>
        {statusLine(m, today)}
      </Text>
      {actionable && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Icon name={online ? "book" : "calendar"} size={15} color={t.greenText} />
          <Text variant="smallBold" tone="greenText">
            {online ? "Read and confirm online" : "Book a session"}
          </Text>
          <Icon name="chevronRight" size={13} color={t.greenText} />
        </View>
      )}
    </Card>
  );
  if (!actionable) return body(false);
  return (
    <Pressable onPress={() => router.push({ pathname: "/module/[code]", params: { code: m.code } })} accessibilityRole="button">{({ pressed }) => body(pressed)}</Pressable>
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
