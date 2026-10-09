import { View } from "react-native";

import { initials } from "@satisfy/core/domain";
import { useTheme, type Palette } from "@/theme";

import { Text } from "./text";

const PALETTE: [keyof Palette, keyof Palette][] = [
  ["greenTint", "greenDeep"],
  ["tealTint", "tealDeep"],
  ["orangeTint", "orangeText"],
  ["skyTint", "skyText"],
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const SIZES = { sm: 32, md: 40, lg: 64 } as const;

/** Initials on a brand tint, the same colour for a person as on the web. */
export function Avatar({ person, size = "md", ring }: { person: { firstName: string; lastName: string | null }; size?: keyof typeof SIZES; ring?: keyof Palette }) {
  const t = useTheme();
  const [bg, fg] = PALETTE[hash(person.firstName + (person.lastName ?? "")) % PALETTE.length];
  const d = SIZES[size];
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: d,
        height: d,
        borderRadius: d / 2,
        backgroundColor: t[bg],
        alignItems: "center",
        justifyContent: "center",
        borderWidth: ring ? 2 : 0,
        borderColor: ring ? t[ring] : undefined,
      }}
    >
      <Text variant={size === "lg" ? "title" : size === "md" ? "smallBold" : "caption"} tone={fg} style={size === "sm" && { fontFamily: "Montserrat_700Bold", fontSize: 11 }}>
        {initials(person)}
      </Text>
    </View>
  );
}

/** Overlapping avatars for a crew. */
export function AvatarStack({ people, ring = "card", max = 4 }: { people: { firstName: string; lastName: string | null }[]; ring?: keyof Palette; max?: number }) {
  return (
    <View style={{ flexDirection: "row" }}>
      {people.slice(0, max).map((p, i) => (
        <View key={`${p.firstName}-${p.lastName}-${i}`} style={{ marginLeft: i === 0 ? 0 : -6 }}>
          <Avatar person={p} size="sm" ring={ring} />
        </View>
      ))}
    </View>
  );
}
