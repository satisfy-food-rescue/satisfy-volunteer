import { useLocalSearchParams } from "expo-router";

import { ModuleScreen } from "@/screens/module";

export default function ModuleRoute() {
  const { code } = useLocalSearchParams<{ code: string }>();
  return <ModuleScreen code={code} />;
}
