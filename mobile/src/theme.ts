// Satisfy Food Rescue design tokens for the native app. Values follow the
// 2026 brand refresh and match the web theme (src/app/globals.css):
// Blue/Teal is the working colour, Satisfy Green means "all good", Orange
// asks for attention (cover) and Light Blue marks driver shifts and info.
// Components read colours from useTheme() and never hard-code a hex value.
import { useColorScheme, type TextStyle } from "react-native";

const brand = {
  green: "#00a651",
  teal: "#106379",
  orange: "#e08c3c",
  lightBlue: "#4395a2",
  green50: "#80d190",
  green75: "#40bb6a",
  teal90: "#386983",
  orange50: "#f0ba84",
  white: "#ffffff",
} as const;

const light = {
  ...brand,
  background: "#f3f7f8",
  card: "#ffffff",
  cardSunk: "#eef5f7",
  muted: "#eaf1f3",
  border: "#d6e3e7",
  input: "#c3d4da",
  ink: "#10303a",
  inkSoft: "#48616a",
  mutedText: "#52676f",
  /** Buttons and selection. White on it is 6.8:1. */
  primary: brand.teal,
  primaryPressed: "#0b4a5b",
  /** Links and accent text on the background. */
  tealText: "#106379",
  tealDeep: "#0b4a5b",
  tealTint: "#dcebef",
  tealTintSoft: "#eef5f7",
  /** Small text and icons on a teal fill (4.8:1). */
  tealOn: "#b8e3c4",
  greenText: "#00783b",
  greenDeep: "#005a2c",
  greenTint: "#dbf2e3",
  greenTintSoft: "#edf8f1",
  orangePressed: "#eaa465",
  orangeText: "#8f4a10",
  orangeTint: "#fbe9d7",
  /** Ink on an orange fill (5.3:1); white on orange fails AA. */
  onOrange: "#10303a",
  skyText: "#1d5c66",
  skyTint: "#dfeff1",
  bad: "#b42318",
  badTint: "#fee4e2",
  neutral: "#4b5d64",
  neutralTint: "#e9eff1",
  /** The teal hero band on Home and sign-in stays teal in both schemes. */
  hero: brand.teal,
  shadow: "rgba(16, 48, 58, 0.45)",
};

export type Palette = Record<keyof typeof light, string>;

const dark: Palette = {
  ...light,
  background: "#0b1f26",
  card: "#122a33",
  cardSunk: "#0f252d",
  muted: "#1a3640",
  border: "#24444f",
  input: "#2f525d",
  ink: "#eef5f7",
  inkSoft: "#c2d4d9",
  mutedText: "#9fb6bd",
  primary: brand.teal,
  primaryPressed: "#0b4a5b",
  tealText: "#7cc6d4",
  tealDeep: "#b9e1e9",
  tealTint: "#173c47",
  tealTintSoft: "#13323b",
  greenText: "#5fd08f",
  greenDeep: "#a6e8c0",
  greenTint: "#123a27",
  greenTintSoft: "#0f2e21",
  orangeText: "#f3bf8c",
  orangeTint: "#3d2a17",
  skyText: "#98d3dc",
  skyTint: "#15363c",
  bad: "#ff9a8f",
  badTint: "#3d1916",
  neutral: "#b7c7cc",
  neutralTint: "#1f363e",
  hero: "#0e5568",
  shadow: "rgba(0, 0, 0, 0.6)",
};

export function useTheme(): Palette {
  return useColorScheme() === "dark" ? dark : light;
}

/** Montserrat is the logo font and is used throughout, as on the web. Custom
 *  fonts need a family per weight; fontWeight alone does nothing on Android. */
export const font = {
  regular: "Montserrat_400Regular",
  medium: "Montserrat_500Medium",
  semibold: "Montserrat_600SemiBold",
  bold: "Montserrat_700Bold",
} as const;

export const type = {
  hero: { fontFamily: font.bold, fontSize: 32, lineHeight: 38, letterSpacing: -0.6 },
  display: { fontFamily: font.bold, fontSize: 28, lineHeight: 34, letterSpacing: -0.5 },
  title: { fontFamily: font.bold, fontSize: 22, lineHeight: 28, letterSpacing: -0.3 },
  heading: { fontFamily: font.bold, fontSize: 18, lineHeight: 24, letterSpacing: -0.2 },
  bodyBold: { fontFamily: font.bold, fontSize: 16, lineHeight: 22 },
  bodySemibold: { fontFamily: font.semibold, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: font.regular, fontSize: 16, lineHeight: 23 },
  small: { fontFamily: font.regular, fontSize: 14, lineHeight: 20 },
  smallSemibold: { fontFamily: font.semibold, fontSize: 14, lineHeight: 20 },
  smallBold: { fontFamily: font.bold, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: font.medium, fontSize: 12, lineHeight: 16 },
  eyebrow: { fontFamily: font.bold, fontSize: 12, lineHeight: 16, letterSpacing: 1.6, textTransform: "uppercase" },
} satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

/** Card corners match the web (rounded-2xl, about 25px). */
export const radius = { sm: 8, md: 12, lg: 16, xl: 20, card: 24, pill: 999 } as const;

/** Minimum tap target, as on the web. */
export const TAP = 44;
