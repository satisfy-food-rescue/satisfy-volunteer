import { createContext, use, useCallback, useMemo, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { radius, useTheme } from "@/theme";

import { Icon } from "./ui/icon";
import { Text } from "./ui/text";

type Kind = "success" | "error";
type Toast = { id: number; message: string; kind: Kind };
type ToastApi = { show: (message: string, kind?: Kind) => void };

const ToastContext = createContext<ToastApi | null>(null);

/** One message at a time near the top of the screen, like the web's sonner
 *  toasts: the result of an action, in the volunteer's words. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const t = useTheme();

  const show = useCallback((message: string, kind: Kind = "success") => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ id: Date.now(), message, kind });
    timer.current = setTimeout(() => setToast(null), kind === "error" ? 5000 : 3200);
  }, []);
  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext value={api}>
      {children}
      <View pointerEvents="box-none" style={{ position: "absolute", top: insets.top + 8, left: 16, right: 16 }}>
        {toast && (
          <Animated.View key={toast.id} entering={FadeInUp.duration(220)} exiting={FadeOutUp.duration(180)}>
            <Pressable
              onPress={() => setToast(null)}
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              accessibilityHint="Dismisses the message"
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderRadius: radius.xl,
                borderCurve: "continuous",
                backgroundColor: toast.kind === "success" ? t.ink : t.bad,
                boxShadow: `0 10px 30px -12px ${t.shadow}`,
              }}
            >
              <Icon name={toast.kind === "success" ? "checkCircle" : "alert"} size={20} color={toast.kind === "success" ? t.green50 : t.white} />
              <Text variant="bodySemibold" tone={toast.kind === "success" ? "background" : "white"} style={{ flex: 1 }}>
                {toast.message}
              </Text>
            </Pressable>
          </Animated.View>
        )}
      </View>
    </ToastContext>
  );
}

export function useToast(): ToastApi {
  const toast = use(ToastContext);
  if (!toast) throw new Error("useToast must be used inside ToastProvider");
  return toast;
}
