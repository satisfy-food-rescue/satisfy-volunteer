import * as WebBrowser from "expo-web-browser";
import { Pressable, View } from "react-native";

import { Text } from "@/components/ui/text";
import { API_URL } from "@/lib/config";

const LINKS = [
  { path: "/privacy", label: "Privacy policy" },
  { path: "/terms", label: "Terms of use" },
] as const;

/** The website's privacy policy and terms of use, linked where the web app
 *  links them: the signed-out screens and the profile. The app stores ask for
 *  the privacy policy to be reachable inside the app. */
export function LegalLinks({ onHero }: { onHero?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "center", gap: 24 }}>
      {LINKS.map((l) => (
        <Pressable
          key={l.path}
          accessibilityRole="link"
          accessibilityHint="Opens in the browser"
          onPress={() => void WebBrowser.openBrowserAsync(`${API_URL}${l.path}`)}
          style={({ pressed }) => ({ minHeight: 44, justifyContent: "center", opacity: pressed ? 0.6 : 1 })}
        >
          <Text variant="smallSemibold" tone={onHero ? "white" : "inkSoft"} style={{ textDecorationLine: "underline" }}>
            {l.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
