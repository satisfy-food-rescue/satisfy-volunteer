import { View } from "react-native";

import type { ShiftDetail } from "@satisfy/core/api";
import { formatDayLong, formatTimeRange, relativeDay } from "@satisfy/core/dates";
import { fullName } from "@satisfy/core/domain";
import { QueryScreen } from "@/components/screen";
import { KindTile } from "@/components/shift/kind-tile";
import { ShiftActions } from "@/components/shift/shift-actions";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Icon, type IconName } from "@/components/ui/icon";
import { Section } from "@/components/ui/section";
import { EmptyLine } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { useSession, useShift } from "@/lib/queries";
import { radius, useTheme } from "@/theme";

export function ShiftDetailScreen({ id }: { id: string }) {
  const query = useShift(id);
  const today = useSession().data?.today ?? "";
  return <QueryScreen query={query}>{(shift) => <Detail shift={shift} today={today} />}</QueryScreen>;
}

function Row({ icon, children }: { icon: IconName; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 12 }}>
      <View style={{ paddingTop: 2 }}>
        <Icon name={icon} size={18} color={t.lightBlue} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>{children}</View>
    </View>
  );
}

function Detail({ shift, today }: { shift: ShiftDetail; today: string }) {
  const t = useTheme();
  return (
    <>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 16 }}>
        <KindTile kind={shift.kind} size={56} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="eyebrow" tone="tealText">
            {relativeDay(shift.iso, today)}
          </Text>
          <Text variant="display" accessibilityRole="header">
            {shift.name}
          </Text>
        </View>
      </View>

      <Card style={{ gap: 14 }}>
        <Row icon="clock">
          <Text variant="bodyBold">{formatDayLong(shift.iso)}</Text>
          <Text variant="body" tone="inkSoft" tabular>
            {formatTimeRange(shift.startTime, shift.endTime)}
          </Text>
        </Row>
        <Row icon="pin">
          <Text variant="body">{shift.location}</Text>
          {shift.volunteerDriven && (
            <Text variant="small" tone="mutedText">
              Fully volunteer-driven route
            </Text>
          )}
        </Row>
        {shift.workingWith && (
          <Row icon="person">
            <Text variant="body">Working with {shift.workingWith}</Text>
          </Row>
        )}
        {shift.stops.length > 0 && (
          <Row icon="store">
            <Text variant="body">{shift.stops.join(", ")}</Text>
          </Row>
        )}
        <Row icon="people">
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
            <Text variant="body" tabular>
              {shift.confirmedCount} of {shift.capacity} places filled
            </Text>
            {shift.isGap && <Chip tone="bad" icon="cover" small label={`Needs ${shift.shortBy} more`} />}
          </View>
        </Row>
      </Card>

      {shift.isGap && shift.causes.length > 0 && (
        <View style={{ padding: 14, borderRadius: radius.lg, borderCurve: "continuous", backgroundColor: t.orangeTint }}>
          <Text variant="smallSemibold" tone="orangeText">
            {shift.causes.join(". ")}.
          </Text>
        </View>
      )}

      <ShiftActions shift={shift} />

      <Section title="Who's on">
        {shift.crew.length === 0 ? (
          <EmptyLine text="Nobody yet. Be the first." />
        ) : (
          <Card padded={false}>
            {shift.crew.map((c, i) => (
              <View
                key={c.assignmentId}
                style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: t.border }}
              >
                <Avatar person={c} size="sm" />
                <Text variant="bodySemibold" style={{ flex: 1 }}>
                  {c.isMe ? "You" : fullName(c)}
                </Text>
                {c.source === "COVER" && <Chip tone="info" small label="Covering" />}
                {c.source === "REGULAR" && (
                  <Text variant="caption" tone="mutedText">
                    Regular
                  </Text>
                )}
              </View>
            ))}
          </Card>
        )}
      </Section>
    </>
  );
}
