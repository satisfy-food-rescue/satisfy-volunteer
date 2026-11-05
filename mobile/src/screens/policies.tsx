import { router } from "expo-router";
import { Pressable, View } from "react-native";

import type { DocumentItem } from "@satisfy/core/api";
import { formatDate } from "@satisfy/core/dates";
import { QueryScreen } from "@/components/screen";
import { Chip } from "@/components/ui/chip";
import { Icon } from "@/components/ui/icon";
import { Section } from "@/components/ui/section";
import { EmptyState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { usePolicies } from "@/lib/queries";
import { radius, useTheme } from "@/theme";

/** Satisfy's policies, always the latest version, and the agreements the
 *  volunteer has signed. */
export function PoliciesScreen() {
  const query = usePolicies();
  return (
    <QueryScreen query={query}>
      {({ documents }) => {
        const policies = documents.filter((d) => d.kind === "POLICY");
        const agreements = documents.filter((d) => d.kind === "AGREEMENT");
        return (
          <>
            <View style={{ gap: 8 }}>
              <Text variant="eyebrow" tone="tealText">
                Health, safety and how we work
              </Text>
              <Text variant="body" tone="inkSoft">
                Satisfy&apos;s policies, always the latest version, and the agreements you have signed. When a policy changes, we ask you to read it and tick to confirm.
              </Text>
            </View>
            {documents.length === 0 ? (
              <EmptyState icon="document" title="No policies here yet" text="The coordinator adds them here as they are published." />
            ) : (
              <>
                {policies.length > 0 && (
                  <Section title="Policies">
                    {policies.map((d) => (
                      <DocumentRow key={d.id} doc={d} />
                    ))}
                  </Section>
                )}
                {agreements.length > 0 && (
                  <Section title="Your agreements">
                    {agreements.map((d) => (
                      <DocumentRow key={d.id} doc={d} />
                    ))}
                  </Section>
                )}
              </>
            )}
          </>
        );
      }}
    </QueryScreen>
  );
}

function DocumentRow({ doc: d }: { doc: DocumentItem }) {
  const t = useTheme();
  const agreement = d.kind === "AGREEMENT";
  const line = d.needsAction
    ? d.version > 1
      ? `Updated ${formatDate(d.versionISO)}`
      : d.summary
    : d.readISO
      ? `${agreement ? "Signed" : "Read"} ${formatDate(d.readISO)}`
      : d.summary;
  const chip = agreement ? "To sign" : d.version > 1 ? "Updated" : "To read";
  const done = agreement ? "Signed" : "Read";
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/policies/[id]", params: { id: d.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${d.title}, ${d.needsAction ? chip : done}, ${line}`}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        minHeight: 64,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: radius.card,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: pressed ? t.tealText : t.border,
        backgroundColor: t.card,
      })}
    >
      <Icon name={agreement ? "signature" : "document"} size={20} color={t.tealText} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodySemibold">{d.title}</Text>
        <Text variant="small" tone="mutedText">
          {line}
        </Text>
      </View>
      {d.needsAction ? <Chip tone={agreement ? "info" : "warn"} label={chip} small /> : <Icon name="checkCircle" size={20} color={t.greenText} />}
      <Icon name="chevronRight" size={16} color={t.mutedText} />
    </Pressable>
  );
}
