import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import type { DocumentItem } from "@satisfy/core/api";
import { formatDate } from "@satisfy/core/dates";
import { ChangeNote, DocumentBody } from "@/components/document";
import { QueryScreen } from "@/components/screen";
import { Button } from "@/components/ui/button";
import { CheckRow } from "@/components/ui/check-row";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { actions, useAction, usePolicy } from "@/lib/queries";
import { radius, useTheme } from "@/theme";

/** A policy or agreement: read it, then confirm a policy here. Agreements
 *  are signed together on the induction. */
export function PolicyScreen({ id }: { id: string }) {
  const query = usePolicy(id);
  return <QueryScreen query={query}>{(doc) => <Policy doc={doc} />}</QueryScreen>;
}

function Policy({ doc: d }: { doc: DocumentItem }) {
  const t = useTheme();
  const agreement = d.kind === "AGREEMENT";
  const updated = d.needsAction && d.readVersion !== null;
  return (
    <>
      <View style={{ gap: 8 }}>
        <Text variant="eyebrow" tone="tealText">
          {agreement ? "Agreement" : "Policy"}
        </Text>
        <Text variant="display" accessibilityRole="header">
          {d.title}
        </Text>
        <Text variant="body" tone="inkSoft">
          {d.summary}
        </Text>
      </View>
      {updated && d.versionNote && <ChangeNote lead={`Updated ${formatDate(d.versionISO)}.`} note={d.versionNote} />}
      <DocumentBody doc={d} />
      {!d.needsAction ? (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ paddingTop: 1 }}>
            <Icon name="checkCircle" size={20} color={t.greenText} />
          </View>
          <Text variant="bodySemibold" tone="greenText" style={{ flex: 1 }}>
            {agreement ? "You signed this" : "You confirmed you read this"}
            {d.readISO ? ` on ${formatDate(d.readISO)}` : ""}.
          </Text>
        </View>
      ) : agreement ? (
        <View style={{ gap: 12, padding: 16, borderRadius: radius.card, borderCurve: "continuous", borderWidth: 1, borderColor: t.tealTint, backgroundColor: t.tealTintSoft }}>
          <Text variant="body">
            {updated ? "This agreement has been updated. Please sign the new version." : "You have not signed this yet."} Agreements are signed together on your induction page.
          </Text>
          <Button label="Read and sign" icon="signature" block onPress={() => router.push("/induction")} />
        </View>
      ) : (
        <Acknowledge doc={d} updated={updated} />
      )}
    </>
  );
}

/** "I have read it": a tick box, then confirm. Recorded against this
 *  version, so the coordinator can see who has read the latest. */
function Acknowledge({ doc, updated }: { doc: DocumentItem; updated: boolean }) {
  const t = useTheme();
  const [ticked, setTicked] = useState(false);
  const confirm = useAction(actions.acknowledgePolicy);
  return (
    <View style={{ gap: 12, padding: 16, borderRadius: radius.card, borderCurve: "continuous", borderWidth: 1, borderColor: t.tealTint, backgroundColor: t.tealTintSoft }}>
      <CheckRow checked={ticked} onToggle={() => setTicked((v) => !v)}>
        I have read {updated ? "the updated" : "the"} <Text variant="bodySemibold">{doc.title}</Text>.
      </CheckRow>
      <Button label="Confirm" icon="check" block disabled={!ticked} loading={confirm.isPending} onPress={() => confirm.mutate({ id: doc.id, version: doc.version })} />
    </View>
  );
}
