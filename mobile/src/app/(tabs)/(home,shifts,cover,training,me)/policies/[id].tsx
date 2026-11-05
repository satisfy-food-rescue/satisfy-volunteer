import { useLocalSearchParams } from "expo-router";

import { PolicyScreen } from "@/screens/policy";

export default function PolicyRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PolicyScreen id={id} />;
}
