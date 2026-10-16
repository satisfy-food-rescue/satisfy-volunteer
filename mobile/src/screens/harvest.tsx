import { router } from "expo-router";
import { Alert, Pressable, View } from "react-native";

import type { HarvestOverview, ModuleSummary } from "@satisfy/core/api";
import { FoodIcon } from "@/components/brand/logo";
import { Photo } from "@/components/photo";
import { QueryScreen } from "@/components/screen";
import { ShiftCard } from "@/components/shift/shift-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TrainingChip } from "@/components/ui/chip";
import { Icon } from "@/components/ui/icon";
import { Section } from "@/components/ui/section";
import { EmptyLine } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { actions, useAction, useHarvest } from "@/lib/queries";
import { useTheme } from "@/theme";

export function HarvestScreen() {
  const query = useHarvest();
  return (
    <QueryScreen query={query}>
      {(harvest) => (
        <>
          <Text variant="eyebrow" tone="tealText">
            Seasonal
          </Text>
          <Pool harvest={harvest} />
          {harvest.training.length > 0 && <Training harvest={harvest} />}
          <Section title="Upcoming harvests">
            {harvest.harvests.length === 0 ? (
              <EmptyLine text={`No harvests planned right now. ${harvest.inPool ? "We will let you know when the fruit is ready." : "Join the pool to hear when the fruit is ready."}`} />
            ) : (
              // Outside the pool the join button above says it all.
              harvest.harvests.map((s) => <ShiftCard key={s.id} shift={s} showDate hideReason={!harvest.inPool} />)
            )}
          </Section>
        </>
      )}
    </QueryScreen>
  );
}

function Pool({ harvest }: { harvest: HarvestOverview }) {
  const toggle = useAction(actions.setHarvestPool);
  const onPress = () => {
    if (!harvest.inPool) return toggle.mutate(true);
    Alert.alert("Leave the harvest pool?", "Harvests you are already booked on stay booked.", [
      { text: "Stay in", style: "cancel" },
      { text: "Leave", style: "destructive", onPress: () => toggle.mutate(false) },
    ]);
  };
  return (
    <Card border={harvest.inPool ? "green50" : "border"} background={harvest.inPool ? "greenTintSoft" : "card"} padded={false}>
      <Photo photo="harvest" style={{ aspectRatio: 16 / 9 }} />
      <View style={{ padding: 20, gap: 16 }}>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <FoodIcon kind="broccoli" size={48} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="bodyBold">{harvest.inPool ? "You're in the harvest pool" : "Join the harvest pool"}</Text>
            <Text variant="small" tone="inkSoft">
              Whenever fruit is ready, we pick it from orchards and backyard trees that would otherwise waste it. When a harvest is on, everyone in the pool gets an email and a notification, and the first to sign up get the places. {harvest.poolCount} volunteers are in the pool.
            </Text>
          </View>
        </View>
        <Button
          label={harvest.inPool ? "Leave the harvest pool" : "Count me in for harvests"}
          variant={harvest.inPool ? "outline" : "primary"}
          block
          loading={toggle.isPending}
          onPress={onPress}
        />
      </View>
    </Card>
  );
}

function Training({ harvest }: { harvest: HarvestOverview }) {
  const t = useTheme();
  const toDo = harvest.training.filter((m) => m.status === "NOT_STARTED" || m.status === "OVERDUE").length;
  return (
    <Section
      title="Harvest training"
      aside={
        harvest.trained ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Icon name="checkCircle" size={15} color={t.greenText} />
            <Text variant="smallBold" tone="greenText">
              All done
            </Text>
          </View>
        ) : undefined
      }
    >
      <Text variant="small" tone="inkSoft">
        {harvest.trained
          ? harvest.inPool
            ? "You can sign up for any harvest with a place left. We run a short in-person induction at your first harvest."
            : "Your training already covers harvests, so once you join you can sign up straight away."
          : `Complete ${toDo === 1 ? "this module" : "these modules"} online before your first harvest. The in-person induction happens on the day.`}
      </Text>
      {harvest.training.map((m) => (
        <ModuleLine key={m.id} module={m} />
      ))}
    </Section>
  );
}

function ModuleLine({ module: m }: { module: ModuleSummary }) {
  const t = useTheme();
  return (
    <Pressable onPress={() => router.push({ pathname: "/module/[code]", params: { code: m.code } })} accessibilityRole="button" accessibilityLabel={`${m.name}, ${m.status.toLowerCase().replace("_", " ")}`}>
      {({ pressed }) => (
        <Card border={pressed ? "tealText" : "border"} style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56 }}>
          <Text variant="bodySemibold" style={{ flex: 1 }}>
            {m.name}
          </Text>
          <TrainingChip status={m.status} small />
          <Icon name="chevronRight" size={14} color={t.mutedText} />
        </Card>
      )}
    </Pressable>
  );
}
