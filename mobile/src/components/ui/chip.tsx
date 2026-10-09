import { View } from "react-native";

import type { Tone } from "@satisfy/core/api";
import type { TrainingStatus } from "@satisfy/core/domain";
import { TRAINING_STATUS_LABEL } from "@satisfy/core/domain";
import { radius, useTheme, type Palette } from "@/theme";

import { Icon, type IconName } from "./icon";
import { Text } from "./text";

export type ChipTone = Tone | "muted";

const TONES: Record<ChipTone, { fg: keyof Palette; bg: keyof Palette | null }> = {
  good: { fg: "greenText", bg: "greenTint" },
  warn: { fg: "orangeText", bg: "orangeTint" },
  bad: { fg: "bad", bg: "badTint" },
  neutral: { fg: "neutral", bg: "neutralTint" },
  info: { fg: "skyText", bg: "skyTint" },
  muted: { fg: "mutedText", bg: null },
};

/** Status is never colour alone: every chip carries an icon or a label. */
export function Chip({ tone = "neutral", icon, label, small }: { tone?: ChipTone; icon?: IconName; label: string; small?: boolean }) {
  const t = useTheme();
  const c = TONES[tone];
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        gap: 5,
        paddingHorizontal: small ? 8 : 10,
        paddingVertical: small ? 3 : 5,
        borderRadius: radius.pill,
        backgroundColor: c.bg ? t[c.bg] : "transparent",
        borderWidth: c.bg ? 0 : 1,
        borderStyle: "dashed",
        borderColor: t.border,
      }}
    >
      {icon && <Icon name={icon} size={small ? 13 : 15} color={t[c.fg]} />}
      <Text variant={small ? "caption" : "smallSemibold"} tone={c.fg} style={small && { fontFamily: "Montserrat_600SemiBold" }}>
        {label}
      </Text>
    </View>
  );
}

const TRAINING_TONE: Record<TrainingStatus, ChipTone> = {
  COMPLETE: "good",
  DUE_SOON: "warn",
  OVERDUE: "bad",
  NOT_STARTED: "neutral",
  NOT_REQUIRED: "muted",
};

const TRAINING_ICON: Record<TrainingStatus, IconName> = {
  COMPLETE: "checkCircle",
  DUE_SOON: "clock",
  OVERDUE: "alert",
  NOT_STARTED: "circle",
  NOT_REQUIRED: "minusCircle",
};

export function TrainingChip({ status, small }: { status: TrainingStatus; small?: boolean }) {
  return <Chip tone={TRAINING_TONE[status]} icon={TRAINING_ICON[status]} label={TRAINING_STATUS_LABEL[status]} small={small} />;
}
