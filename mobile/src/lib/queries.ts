import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import { useCallback, useRef } from "react";

import type {
  AuthConfig,
  AwayInput,
  CoverList,
  HarvestOverview,
  Home,
  MobileSession,
  MutationOk,
  ProfileInput,
  SecurityOverview,
  ShiftDetail,
  ShiftsWeek,
  SignUpInput,
  SlotOverview,
  TrainingModuleDetail,
  TrainingOverview,
} from "@satisfy/core/api";
import { useToast } from "@/components/toast";

import { api } from "./api";
import { appleSupported } from "./sign-in";

export const keys = {
  session: ["session"],
  home: ["home"],
  week: (monday: string | null) => ["shifts", monday ?? "current"],
  shift: (id: string) => ["shift", id],
  cover: ["cover"],
  training: ["training"],
  module: (code: string) => ["module", code],
  slot: ["slot"],
  harvest: ["harvest"],
  authConfig: ["auth-config"],
  security: ["security"],
} as const;

export const useSession = () => useQuery({ queryKey: keys.session, queryFn: () => api<MobileSession>("/session") });
export const useHome = () => useQuery({ queryKey: keys.home, queryFn: () => api<Home>("/home") });
export const useShiftsWeek = (monday: string | null) =>
  useQuery({
    queryKey: keys.week(monday),
    queryFn: () => api<ShiftsWeek>(monday ? `/shifts?week=${monday}` : "/shifts"),
    placeholderData: (previous) => previous,
  });
export const useShift = (id: string) => useQuery({ queryKey: keys.shift(id), queryFn: () => api<ShiftDetail>(`/shifts/${encodeURIComponent(id)}`) });
export const useCover = () => useQuery({ queryKey: keys.cover, queryFn: () => api<CoverList>("/cover") });
export const useTraining = () => useQuery({ queryKey: keys.training, queryFn: () => api<TrainingOverview>("/training") });
export const useModule = (code: string) => useQuery({ queryKey: keys.module(code), queryFn: () => api<TrainingModuleDetail>(`/training/modules/${encodeURIComponent(code)}`) });
export const useSlot = () => useQuery({ queryKey: keys.slot, queryFn: () => api<SlotOverview>("/slot") });
export const useHarvest = () => useQuery({ queryKey: keys.harvest, queryFn: () => api<HarvestOverview>("/harvest") });
/** Which sign-in methods the server offers. Read before signing in. */
export const useAuthConfig = () => useQuery({ queryKey: keys.authConfig, queryFn: () => api<AuthConfig>("/auth/config"), staleTime: 5 * 60_000 });
export const useSecurity = () => useQuery({ queryKey: keys.security, queryFn: () => api<SecurityOverview>("/security") });
/** Whether this phone can sign in with Apple (see appleSupported). */
export const useAppleSupported = () => useQuery({ queryKey: ["appleSupported"], queryFn: appleSupported, staleTime: Infinity }).data ?? false;

/** Screens in a tab stay mounted, so refetch stale data when one comes back
 *  into view (e.g. after booking a shift from another tab). */
export function useRefreshOnFocus(refetch: () => unknown) {
  const first = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      refetch();
    }, [refetch]),
  );
}

/** Runs a mutation, shows its message, and refreshes everything once it has
 *  landed: a booking changes Home, Shifts, Cover and the tab badges at once.
 *  The returned promise settles after the refresh, so buttons stay busy until
 *  the screen shows the new state. */
export function useAction<TInput = void>(
  run: (input: TInput) => Promise<MutationOk>,
  options: { onSuccess?: () => void; /** In place of the server's message. */ message?: (input: TInput) => string } = {},
) {
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: run,
    onSuccess: async (result, input) => {
      await queryClient.invalidateQueries();
      if (process.env.EXPO_OS === "ios") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.show(options.message?.(input) ?? result.message, "success");
      options.onSuccess?.();
    },
    onError: (error) => {
      // Backing out of a system prompt (a passkey, say) is not an error.
      if (error.name === "Cancelled") return;
      if (process.env.EXPO_OS === "ios") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      toast.show(error.message, "error");
    },
  });
}

export const actions = {
  book: (shiftId: string) => api<MutationOk>(`/shifts/${encodeURIComponent(shiftId)}/book`, { method: "POST" }),
  cancel: (assignmentId: string) => api<MutationOk>(`/assignments/${encodeURIComponent(assignmentId)}/cancel`, { method: "POST" }),
  markAway: (input: AwayInput) => api<MutationOk>("/absences", { method: "POST", body: input }),
  removeAbsence: (id: string) => api<MutationOk>(`/absences/${encodeURIComponent(id)}`, { method: "DELETE" }),
  completeModule: (moduleId: string) => api<MutationOk>(`/training/modules/${encodeURIComponent(moduleId)}/complete`, { method: "POST" }),
  rsvpSession: ({ id, going }: { id: string; going: boolean }) => api<MutationOk>(`/training/sessions/${encodeURIComponent(id)}/rsvp`, { method: "POST", body: { going } }),
  setHarvestPool: (inPool: boolean) => api<MutationOk>("/harvest/pool", { method: "PUT", body: { inPool } }),
  updateProfile: (input: ProfileInput) => api<MutationOk>("/profile", { method: "PATCH", body: input }),
  requestRoleChange: (message: string) => api<MutationOk>("/profile/role-request", { method: "POST", body: { message } }),
  disconnectApple: () => api<MutationOk>("/apple", { method: "DELETE" }),
  deleteAccount: () => api<MutationOk>("/account", { method: "DELETE" }),
  removePasskey: (id: string) => api<MutationOk>(`/passkeys/${encodeURIComponent(id)}`, { method: "DELETE" }),
  requestSignInLink: (email: string) => api<MutationOk>("/auth/link", { method: "POST", body: { email } }),
  signUp: (input: SignUpInput) => api<MutationOk>("/apply", { method: "POST", body: input }),
};
