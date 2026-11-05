import * as WebBrowser from "expo-web-browser";
import { View } from "react-native";

import type { DocumentItem } from "@satisfy/core/api";
import { useTheme } from "@/theme";

import { useToast } from "./toast";
import { Button } from "./ui/button";
import { Text } from "./ui/text";

/** A policy or agreement: the words written with it, then the document
 *  itself, which lives in Google Drive and opens in the in-app browser so it
 *  is always the board's latest. */
export function DocumentBody({ doc }: { doc: DocumentItem }) {
  const toast = useToast();
  const viewUrl = doc.viewUrl;
  const open = async () => {
    try {
      await WebBrowser.openBrowserAsync(viewUrl!);
    } catch {
      toast.show("That document would not open. Check your connection and try again.", "error");
    }
  };
  return (
    <View style={{ gap: 12 }}>
      {doc.paragraphs.map((p, i) => (
        <Text key={i} variant="body">
          {p}
        </Text>
      ))}
      {viewUrl && <Button label="Open the document" icon="external" variant="outline" block accessibilityHint="Opens in the browser" onPress={open} />}
    </View>
  );
}

/** What changed in a new version, shown to anyone who read an older one.
 *  `lead` is the bold start, e.g. "What changed:". */
export function ChangeNote({ lead, note }: { lead: string; note: string }) {
  const t = useTheme();
  return (
    <View style={{ padding: 14, borderRadius: 14, borderCurve: "continuous", backgroundColor: t.orangeTint }}>
      <Text variant="small">
        <Text variant="smallBold">{lead}</Text> {note}
      </Text>
    </View>
  );
}

/** An agreement to sign for the first time, or again after an update. */
export function agreementState(doc: DocumentItem): "UNSIGNED" | "UPDATED" | "SIGNED" {
  return !doc.needsAction ? "SIGNED" : doc.readVersion === null ? "UNSIGNED" : "UPDATED";
}
