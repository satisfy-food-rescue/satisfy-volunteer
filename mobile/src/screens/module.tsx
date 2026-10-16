import { router } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Linking, Pressable, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";

import type { TrainingModuleDetail } from "@satisfy/core/api";
import { formatDate } from "@satisfy/core/dates";
import { completionGate, isVideo, linkKindLabel, type Gate, type ModuleLink } from "@satisfy/core/training";
import { QueryScreen } from "@/components/screen";
import { SessionCard } from "@/components/session-card";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TrainingChip } from "@/components/ui/chip";
import { Icon } from "@/components/ui/icon";
import { Section } from "@/components/ui/section";
import { EmptyLine } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { actions, useAction, useModule, useTraining } from "@/lib/queries";
import { radius, useTheme } from "@/theme";

/** Links opened this session, per module, so leaving the screen to watch a
 *  video and coming back (or backing out and in again) keeps the progress. */
const openedByModule = new Map<string, Set<string>>();

/** Tracks whether the volunteer has scrolled past the end of the content.
 *  Content that fits on screen counts as read once it has laid out. */
function useReadToEnd() {
  const [read, setRead] = useState(false);
  const endY = useRef<number | null>(null);
  const viewport = useRef(0);
  const markIfVisible = (visibleBottom: number) => {
    if (endY.current !== null && visibleBottom >= endY.current) setRead(true);
  };
  const scrollProps = {
    scrollEventThrottle: 100,
    onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, layoutMeasurement, contentInset } = e.nativeEvent;
      markIfVisible(contentOffset.y + layoutMeasurement.height - (contentInset?.bottom ?? 0));
    },
    onLayout: (e: LayoutChangeEvent) => {
      viewport.current = e.nativeEvent.layout.height;
    },
    onContentSizeChange: (_w: number, h: number) => {
      if (viewport.current > 0 && h <= viewport.current) setRead(true);
    },
  };
  const onEndLayout = useCallback((y: number) => {
    endY.current = y;
  }, []);
  return { read, scrollProps, onEndLayout };
}

export function ModuleScreen({ code }: { code: string }) {
  const query = useModule(code);
  const { read, scrollProps, onEndLayout } = useReadToEnd();
  return (
    <QueryScreen query={query} {...scrollProps}>
      {(detail) => <Module detail={detail} readToEnd={read || detail.paragraphs.length === 0} onEndLayout={onEndLayout} />}
    </QueryScreen>
  );
}

function Module({ detail, readToEnd, onEndLayout }: { detail: TrainingModuleDetail; readToEnd: boolean; onEndLayout: (y: number) => void }) {
  const t = useTheme();
  const m = detail.module;
  const online = m.delivery === "ONLINE_CONFIRM";
  const [opened, setOpened] = useState<ReadonlySet<string>>(() => new Set(openedByModule.get(m.id)));
  const markOpened = (id: string) => {
    const next = new Set(opened).add(id);
    openedByModule.set(m.id, next);
    setOpened(next);
  };
  const gate = completionGate({ hasContent: detail.paragraphs.length > 0, readToEnd, links: detail.links, opened });
  return (
    <>
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <Text variant="eyebrow" tone="tealText">
            {online ? (detail.links.length ? "Online: read, watch and confirm" : "Online: read and confirm") : "In-person session"}
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
          {detail.paragraphs.length > 0 && (
            <View style={{ gap: 10 }} onLayout={(e) => onEndLayout(e.nativeEvent.layout.y + e.nativeEvent.layout.height)}>
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
          )}
          {detail.links.length > 0 && (
            <Section title={detail.links.every((l) => isVideo(l.url)) ? (detail.links.length === 1 ? "Watch the video" : "Watch the videos") : "Open each link"}>
              {detail.links.map((l) => (
                <LinkCard key={l.id} link={l} opened={opened.has(l.id)} onOpened={() => markOpened(l.id)} />
              ))}
            </Section>
          )}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ paddingTop: 2 }}>
              <Icon name="shield" size={15} color={t.mutedText} />
            </View>
            <Text variant="small" tone="mutedText" style={{ flex: 1 }}>
              Confirming records the date against your name and lifts any booking block straight away. The coordinator can see who has completed what.
            </Text>
          </View>
          {m.status !== "COMPLETE" && <ConfirmModule moduleId={m.id} moduleName={m.name} gate={gate} />}
        </>
      ) : (
        <InPersonSessions moduleId={m.id} />
      )}
    </>
  );
}

function LinkCard({ link, opened, onOpened }: { link: ModuleLink; opened: boolean; onOpened: () => void }) {
  const t = useTheme();
  const toast = useToast();
  const video = isVideo(link.url);
  const open = async () => {
    try {
      await Linking.openURL(link.url);
      onOpened();
    } catch {
      toast.show("That link would not open. Check your connection and try again.", "error");
    }
  };
  return (
    <Pressable
      onPress={open}
      accessibilityRole="link"
      accessibilityLabel={`${link.label}, ${linkKindLabel(link.url)}${opened ? ", opened" : ""}`}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 14,
        minHeight: 64,
        borderRadius: radius.card,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: opened ? t.green75 : t.border,
        backgroundColor: pressed ? t.cardSunk : t.card,
      })}
    >
      <View style={{ width: 44, height: 44, borderRadius: radius.lg, borderCurve: "continuous", alignItems: "center", justifyContent: "center", backgroundColor: video ? t.skyTint : t.tealTint }}>
        <Icon name={video ? "play" : "external"} size={22} color={video ? t.skyText : t.tealDeep} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyBold">{link.label}</Text>
        <Text variant={opened ? "smallBold" : "small"} tone={opened ? "greenText" : "mutedText"}>
          {linkKindLabel(link.url)}
          {opened ? " · opened" : ""}
        </Text>
      </View>
      {opened ? <Icon name="checkCircle" size={22} color={t.greenText} /> : <Icon name="external" size={18} color={t.mutedText} />}
    </Pressable>
  );
}

function ConfirmModule({ moduleId, moduleName, gate }: { moduleId: string; moduleName: string; gate: Gate }) {
  const t = useTheme();
  const [checked, setChecked] = useState(false);
  const complete = useAction(actions.completeModule, { onSuccess: () => router.back() });
  const locked = !gate.ready;
  const on = checked && !locked;
  return (
    <View style={{ gap: 14, padding: 16, borderRadius: radius.card, borderCurve: "continuous", backgroundColor: t.tealTintSoft, borderWidth: 1, borderColor: t.tealTint }}>
      {gate.steps.length > 0 && (
        <View style={{ gap: 6 }} accessibilityLabel="Before you confirm">
          {gate.steps.map((s) => (
            <View key={s.key} style={{ flexDirection: "row", alignItems: "center", gap: 8 }} accessibilityLabel={`${s.label}, ${s.done ? "done" : "not done yet"}`}>
              <Icon name={s.done ? "checkCircle" : "circle"} size={18} color={s.done ? t.greenText : t.mutedText} />
              <Text variant="smallBold" tone={s.done ? "greenText" : "inkSoft"}>
                {s.label}
              </Text>
            </View>
          ))}
        </View>
      )}
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: on, disabled: locked }}
        disabled={locked}
        onPress={() => setChecked((c) => !c)}
        style={{ flexDirection: "row", gap: 12, padding: 14, borderRadius: radius.lg, borderCurve: "continuous", backgroundColor: t.card, borderWidth: 1, borderColor: on ? t.tealText : t.border, opacity: locked ? 0.6 : 1 }}
      >
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 7,
            borderWidth: 2,
            borderColor: on ? t.primary : t.input,
            backgroundColor: on ? t.primary : "transparent",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {on && <Icon name="check" size={14} color={t.white} />}
        </View>
        <Text variant="body" style={{ flex: 1 }}>
          I have read and understood {moduleName} and will follow it on every shift.
        </Text>
      </Pressable>
      {locked && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: -4 }}>
          <Icon name="lock" size={14} color={t.mutedText} />
          <Text variant="small" tone="mutedText">
            Unlocks once the steps above are done.
          </Text>
        </View>
      )}
      <Button label="Record completion" icon="checkCircle" block disabled={!on} loading={complete.isPending} onPress={() => complete.mutate(moduleId)} />
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
