import { useLocalSearchParams } from "expo-router";

import { ShiftDetailScreen } from "@/screens/shift-detail";

export default function ShiftRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ShiftDetailScreen id={id} />;
}
