import { useQueryClient } from "@tanstack/react-query";
import * as SecureStore from "expo-secure-store";
import { createContext, use, useCallback, useEffect, useMemo, useState } from "react";

import type { MutationOk, SignInResult, SignOutInput } from "@satisfy/core/api";

import { api, setApiToken, setUnauthorizedHandler } from "./api";
import { forgetPushToken, registerForPush, storedPushToken } from "./push";
import { keys } from "./queries";

const TOKEN_KEY = "satisfy.session-token";

type Status = "loading" | "signedOut" | "signedIn";

type Auth = {
  status: Status;
  signInAsPersona: (personaKey: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Status>("loading");

  const clearLocal = useCallback(async () => {
    setApiToken(null);
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await forgetPushToken();
    queryClient.clear();
    setStatus("signedOut");
  }, [queryClient]);

  useEffect(() => {
    setUnauthorizedHandler(() => void clearLocal());
    SecureStore.getItemAsync(TOKEN_KEY)
      .then((token) => {
        setApiToken(token);
        setStatus(token ? "signedIn" : "signedOut");
      })
      .catch(() => setStatus("signedOut"));
    return () => setUnauthorizedHandler(null);
  }, [clearLocal]);

  // Keep this device's push token registered: tokens can rotate, and the
  // server forgets tokens that stop working.
  useEffect(() => {
    if (status === "signedIn") registerForPush({ ask: false }).catch(() => {});
  }, [status]);

  const signInAsPersona = useCallback(
    async (personaKey: string) => {
      const result = await api<SignInResult>("/auth/demo", { method: "POST", body: { personaKey } });
      await SecureStore.setItemAsync(TOKEN_KEY, result.token);
      setApiToken(result.token);
      queryClient.clear();
      queryClient.setQueryData(keys.session, result.session);
      setStatus("signedIn");
      // Cover requests are the reason to have the app on a phone, so ask
      // for notification permission straight after signing in.
      registerForPush({ ask: true }).catch(() => {});
    },
    [queryClient],
  );

  const signOut = useCallback(async () => {
    const pushToken = await storedPushToken();
    const body: SignOutInput = pushToken ? { pushToken } : {};
    await api<MutationOk>("/auth/session", { method: "DELETE", body }).catch(() => {});
    await clearLocal();
  }, [clearLocal]);

  const value = useMemo(() => ({ status, signInAsPersona, signOut }), [status, signInAsPersona, signOut]);
  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): Auth {
  const auth = use(AuthContext);
  if (!auth) throw new Error("useAuth must be used inside AuthProvider");
  return auth;
}
