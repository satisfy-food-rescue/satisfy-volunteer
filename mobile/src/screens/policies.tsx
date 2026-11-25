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

/** The agreements from the volunteer's induction, and Satisfy's policies,
 *  always the latest version. */
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
                The agreements from your induction and Satisfy&apos;s policies, always the latest version. When one changes, we ask you to read it and tick to confirm.
              </Text>
            </View>
            {documents.length === 0 ? (
              <EmptyState icon="document" title="Nothing here yet" text="The coordinator adds agreements and policies here as they are published." />
            ) : (
              <>
                {agreements.length > 0 && (
                  <Section title="Your agreements">
                    {agreements.map((d) => (
                      <DocumentRow key={d.id} doc={d} />
                    ))}
                  </Section>
                )}
                {policies.length > 0 && (
                  <Section title="Policies">
                    {policies.map((d) => (
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
  const signs = agreement && d.acceptance !== "READ";
  const line = d.needsAction
    ? d.version > 1
      ? `Updated ${formatDate(d.versionISO)}`
      : d.summary
    : d.readISO
      ? `${signs ? "Signed" : agreement ? "Read and understood" : "Read"} ${formatDate(d.readISO)}`
      : d.summary;
  const chip = signs ? "To sign" : agreement ? "To read" : d.version > 1 ? "Updated" : "To read";
  const done = signs ? "Signed" : "Read";
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
