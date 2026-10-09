import { focusManager, QueryClient } from "@tanstack/react-query";
import { AppState } from "react-native";

import { ApiError } from "./api";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // A 4xx will not fix itself; network blips and 5xx get one more try.
      retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 1,
    },
    mutations: { retry: false },
  },
});

// Refetch stale queries when the app comes back to the foreground.
AppState.addEventListener("change", (state) => focusManager.setFocused(state === "active"));
