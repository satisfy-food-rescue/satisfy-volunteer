import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";

import type { TrainingModuleDetail } from "@satisfy/core/api";
import { formatDate } from "@satisfy/core/dates";
import { QueryScreen } from "@/components/screen";
import { SessionCard } from "@/components/session-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TrainingChip } from "@/components/ui/chip";
import { Icon } from "@/components/ui/icon";
import { Section } from "@/components/ui/section";
import { EmptyLine } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { actions, useAction, useModule, useTraining } from "@/lib/queries";
import { radius, useTheme } from "@/theme";

export function ModuleScreen({ code }: { code: string }) {
  const query = useModule(code);
  return <QueryScreen query={query}>{(detail) => <Module detail={detail} />}</QueryScreen>;
}

function Module({ detail }: { detail: TrainingModuleDetail }) {
  const t = useTheme();
  const m = detail.module;
  const online = m.delivery === "ONLINE_CONFIRM";
  return (
    <>
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <Text variant="eyebrow" tone="tealText">
            {online ? "Online: read and confirm" : "In-person session"}
          </Text>
          <TrainingChip status={m.status} small />
        </View>
        <Text variant="display" accessibilityRole="header">
          {m.name}
        </Text>
        <Text variant="body" tone="inkSoft">
          {m.description}
        </Text>
        {m.expiresISO && (
          <Text variant="small" tone="mutedText" tabular>
            {m.status === "OVERDUE" ? "Expired" : "Expires"} {formatDate(m.expiresISO)}. Confirming today records a fresh {m.validityMonths}-month completion.
          </Text>
        )}
      </View>
      {online ? (
        <>
          <View style={{ gap: 10 }}>
            {detail.paragraphs.map((p, i) => (
              <Card key={i} style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: t.tealTint }}>
                  <Text variant="smallBold" tone="tealDeep">
                    {i + 1}
                  </Text>
                </View>
                <Text variant="body" style={{ flex: 1 }}>
                  {p}
                </Text>
              </Card>
            ))}
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ paddingTop: 2 }}>
              <Icon name="shield" size={15} color={t.mutedText} />
            </View>
            <Text variant="small" tone="mutedText" style={{ flex: 1 }}>
              Confirming records the date against your name and lifts any booking block straight away. The coordinator can see who has completed what.
            </Text>
          </View>
          {m.status !== "COMPLETE" && <ConfirmModule moduleId={m.id} moduleName={m.name} />}
        </>
      ) : (
        <InPersonSessions moduleId={m.id} />
      )}
    </>
  );
}

function ConfirmModule({ moduleId, moduleName }: { moduleId: string; moduleName: string }) {
  const t = useTheme();
  const [checked, setChecked] = useState(false);
  const complete = useAction(actions.completeModule, { onSuccess: () => router.back() });
  return (
    <View style={{ gap: 14, padding: 16, borderRadius: radius.card, borderCurve: "continuous", backgroundColor: t.tealTintSoft, borderWidth: 1, borderColor: t.tealTint }}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        onPress={() => setChecked((c) => !c)}
        style={{ flexDirection: "row", gap: 12, padding: 14, borderRadius: radius.lg, borderCurve: "continuous", backgroundColor: t.card, borderWidth: 1, borderColor: checked ? t.tealText : t.border }}
      >
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 7,
            borderWidth: 2,
            borderColor: checked ? t.primary : t.input,
            backgroundColor: checked ? t.primary : "transparent",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {checked && <Icon name="check" size={14} color={t.white} />}
        </View>
        <Text variant="body" style={{ flex: 1 }}>
          I have read and understood the {moduleName} refresher and will follow it on every shift.
        </Text>
      </Pressable>
      <Button label="Confirm and record completion" icon="checkCircle" block disabled={!checked} loading={complete.isPending} onPress={() => complete.mutate(moduleId)} />
    </View>
  );
}

function InPersonSessions({ moduleId }: { moduleId: string }) {
  const { data } = useTraining();
  const sessions = data?.sessions.filter((s) => s.moduleId === moduleId) ?? [];
  return (
    <>
      <Card>
        <Text variant="body">This module is completed in person. Book into a session below and the coordinator will mark your attendance on the day.</Text>
      </Card>
      <Section title="Sessions">
        {data === undefined ? null : sessions.length === 0 ? (
          <EmptyLine text="No sessions scheduled for this module right now. The coordinator will add one." />
        ) : (
          sessions.map((s) => <SessionCard key={s.id} session={s} />)
        )}
      </Section>
    </>
  );
}
