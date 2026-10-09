import { SymbolView, type AndroidSymbol, type SFSymbol } from "expo-symbols";
import type { ColorValue } from "react-native";

// Icons by meaning, each an SF Symbol on iOS and a Material Symbol on Android,
// so screens never pick platform glyphs themselves.
const ICONS = {
  home: ["house.fill", "home"],
  calendar: ["calendar", "calendar_month"],
  calendarAway: ["calendar.badge.minus", "event_busy"],
  calendarCheck: ["calendar.badge.checkmark", "event_available"],
  cover: ["hand.raised.fill", "volunteer_activism"],
  training: ["graduationcap.fill", "school"],
  person: ["person.fill", "person"],
  people: ["person.2.fill", "group"],
  clock: ["clock.fill", "schedule"],
  pin: ["mappin.and.ellipse", "location_on"],
  store: ["storefront.fill", "storefront"],
  check: ["checkmark", "check"],
  checkCircle: ["checkmark.circle.fill", "check_circle"],
  circle: ["circle", "radio_button_unchecked"],
  minusCircle: ["minus.circle", "do_not_disturb_on"],
  lock: ["lock.fill", "lock"],
  alert: ["exclamationmark.triangle.fill", "warning"],
  info: ["info.circle.fill", "info"],
  chevronRight: ["chevron.right", "chevron_right"],
  chevronLeft: ["chevron.left", "chevron_left"],
  arrowRight: ["arrow.right", "arrow_forward"],
  book: ["book.fill", "menu_book"],
  trash: ["trash", "delete"],
  sparkles: ["sparkles", "auto_awesome"],
  leaf: ["leaf.fill", "eco"],
  sync: ["arrow.triangle.2.circlepath", "sync"],
  signOut: ["rectangle.portrait.and.arrow.right", "logout"],
  warehouse: ["shippingbox.fill", "warehouse"],
  truck: ["truck.box.fill", "local_shipping"],
  holiday: ["sun.max.fill", "beach_access"],
  sick: ["thermometer.medium", "thermometer"],
  other: ["questionmark.circle.fill", "help"],
  send: ["paperplane.fill", "send"],
  bell: ["bell.fill", "notifications"],
  bellOff: ["bell.slash.fill", "notifications_off"],
  close: ["xmark", "close"],
  cancelled: ["nosign", "block"],
  shield: ["checkmark.shield.fill", "verified_user"],
  wifiOff: ["wifi.exclamationmark", "cloud_off"],
} as const satisfies Record<string, readonly [SFSymbol, AndroidSymbol]>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color: ColorValue }) {
  const [ios, android] = ICONS[name];
  return <SymbolView name={{ ios, android }} size={size} tintColor={color} resizeMode="scaleAspectFit" style={{ width: size, height: size }} />;
}
