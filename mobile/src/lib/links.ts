import type { Href } from "expo-router";

/** Each tab's root. Tabs share their detail screens, so a bare "/shifts"
 *  would open Shifts inside the current tab; switching tabs needs the group. */
export const TAB = {
  home: "/(tabs)/(home)",
  shifts: "/(tabs)/(shifts)/shifts",
  cover: "/(tabs)/(cover)/cover",
  training: "/(tabs)/(training)/training",
  me: "/(tabs)/(me)/me",
} as const satisfies Record<string, Href>;

/** Maps a web app path (what emails and push notifications link to, e.g.
 *  "/app/shifts/abc") to the matching screen in the native app. Unknown
 *  paths land on Home rather than a dead end. */
export function routeForWebPath(url: string | undefined | null): Href {
  if (!url) return TAB.home;
  const path = url.replace(/^[a-z]+:\/\/[^/]+/i, "").split(/[?#]/)[0].replace(/\/+$/, "");
  const parts = path.split("/").filter(Boolean);
  if (parts[0] !== "app") return TAB.home;
  const [, section, id] = parts;
  switch (section) {
    case undefined:
      return TAB.home;
    case "shifts":
      return id ? { pathname: "/shift/[id]", params: { id } } : TAB.shifts;
    case "gaps":
      return TAB.cover;
    case "training":
      return id ? { pathname: "/module/[code]", params: { code: id } } : TAB.training;
    case "slot":
      return "/slot";
    case "harvest":
      return "/harvest";
    case "profile":
      return TAB.me;
    default:
      return TAB.home;
  }
}
