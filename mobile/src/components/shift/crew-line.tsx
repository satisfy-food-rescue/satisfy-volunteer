import { View } from "react-native";

import type { CrewMember } from "@satisfy/core/api";
import { AvatarStack } from "@/components/ui/avatar";
import { Text } from "@/components/ui/text";
import type { Palette } from "@/theme";

/** "with Brian, Sue and 2 more", for everyone on the shift except me. The
 *  count is held together with no-break spaces so a wrap never strands "more"
 *  on a line of its own. */
export function crewNames(others: CrewMember[]): string {
  const named = others.slice(0, 2).map((c) => c.firstName).join(", ");
  return `with ${named}${others.length > 2 ? ` and\u00a0${others.length - 2}\u00a0more` : ""}`;
}

export function CrewLine({ crew, ring = "card" }: { crew: CrewMember[]; ring?: keyof Palette }) {
  const others = crew.filter((c) => !c.isMe);
  if (others.length === 0) return null;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <AvatarStack people={others} ring={ring} max={3} />
      <Text variant="small" tone="inkSoft" style={{ flexShrink: 1 }} numberOfLines={2}>
        {crewNames(others)}
      </Text>
    </View>
  );
}
