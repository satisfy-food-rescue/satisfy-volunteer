import { View } from "react-native";

import type { HarvestOverview } from "@satisfy/core/api";
import { formatDayLong, formatTimeRange } from "@satisfy/core/dates";
import { FoodIcon } from "@/components/brand/logo";
import { QueryScreen } from "@/components/screen";
import { AvatarStack } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Section } from "@/components/ui/section";
import { EmptyLine } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { actions, useAction, useHarvest } from "@/lib/queries";
import { radius, useTheme } from "@/theme";

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
          <Section title="Callouts">
            {harvest.callouts.length === 0 ? (
              <EmptyLine text="No harvests planned right now. We will send a callout when the fruit is ready." />
            ) : (
              harvest.callouts.map((c) => <Callout key={c.id} callout={c} inPool={harvest.inPool} />)
            )}
          </Section>
        </>
      )}
    </QueryScreen>
  );
}

function Pool({ harvest }: { harvest: HarvestOverview }) {
  const toggle = useAction(actions.setHarvestPool);
  return (
    <Card border={harvest.inPool ? "green50" : "border"} background={harvest.inPool ? "greenTintSoft" : "card"} style={{ padding: 20, gap: 16 }}>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <FoodIcon kind="broccoli" size={48} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="bodyBold">{harvest.inPool ? "You're in the pool" : "Join the harvest pool"}</Text>
          <Text variant="small" tone="inkSoft">
            In summer and autumn we pick fruit from orchards and backyard trees with Food Secure North Canterbury. Pool members get a callout with the details and reply in the app. {harvest.poolCount} volunteers are in the pool.
          </Text>
        </View>
      </View>
      <Button
        label={harvest.inPool ? "Leave the harvest pool" : "Count me in for harvests"}
        variant={harvest.inPool ? "outline" : "primary"}
        block
        loading={toggle.isPending}
        onPress={() => toggle.mutate(!harvest.inPool)}
      />
    </Card>
  );
}

function Callout({ callout: c, inPool }: { callout: HarvestOverview["callouts"][number]; inPool: boolean }) {
  const t = useTheme();
  const rsvp = useAction(actions.rsvpHarvest);
  return (
    <Card padded={false}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: t.hero }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: "rgba(255,255,255,0.8)", alignItems: "center", justifyContent: "center" }}>
          <FoodIcon kind="apple" size={36} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="bodyBold" tone="white">
            {c.title}
          </Text>
          <Text variant="small" tone="white" tabular style={{ opacity: 0.85 }}>
            {formatDayLong(c.iso)}, {formatTimeRange(c.startTime, c.endTime)}
          </Text>
        </View>
      </View>
      <View style={{ padding: 16, gap: 12 }}>
        <View style={{ flexDirection: "row", gap: 6 }}>
          <View style={{ paddingTop: 2 }}>
            <Icon name="pin" size={14} color={t.lightBlue} />
          </View>
          <Text variant="small" tone="inkSoft" style={{ flex: 1 }}>
            {c.location} · with {c.partner}
          </Text>
        </View>
        <Text variant="body">{c.description}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Icon name="people" size={15} color={t.mutedText} />
          <Text variant="small" tone="mutedText" tabular>
            {c.going.length} of {c.needed} pickers so far
          </Text>
          <AvatarStack people={c.going} max={5} />
        </View>
        {!inPool ? (
          <View style={{ padding: 14, borderRadius: radius.lg, borderCurve: "continuous", backgroundColor: t.muted }}>
            <Text variant="small" tone="mutedText">
              Join the pool above to respond to this callout.
            </Text>
          </View>
        ) : c.mine === "GOING" ? (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Icon name="check" size={18} color={t.greenText} />
              <Text variant="bodySemibold" tone="greenText">
                You&apos;re going
              </Text>
            </View>
            <Button label="Can't make it" variant="ghost" size="md" loading={rsvp.isPending} onPress={() => rsvp.mutate({ id: c.id, going: false })} />
          </View>
        ) : (
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button label="I can come" icon="check" size="md" block disabled={rsvp.isPending} loading={rsvp.isPending && rsvp.variables?.going === true} onPress={() => rsvp.mutate({ id: c.id, going: true })} />
            {c.mine !== "DECLINED" && (
              <Button label="Not this time" variant="outline" size="md" disabled={rsvp.isPending} loading={rsvp.isPending && rsvp.variables?.going === false} onPress={() => rsvp.mutate({ id: c.id, going: false })} />
            )}
          </View>
        )}
      </View>
    </Card>
  );
}
