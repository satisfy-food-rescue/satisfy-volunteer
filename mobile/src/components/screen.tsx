import type { UseQueryResult } from "@tanstack/react-query";
import { useState } from "react";
import { RefreshControl, ScrollView, type ScrollViewProps } from "react-native";

import { useRefreshOnFocus } from "@/lib/queries";
import { useTheme } from "@/theme";

import { ErrorState, InlineError, LoadingState } from "./ui/states";

/** Pull to refresh that only spins when the volunteer pulled, not for
 *  background refetches. */
export function usePullToRefresh(refetch: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };
  return { refreshing, onRefresh };
}

/** A scrolling screen for one query, with the four states every data screen
 *  needs: loading, error, content, and content with a failed refresh. */
export function QueryScreen<T>({
  query,
  children,
  ...scrollProps
}: { query: UseQueryResult<T, Error>; children: (data: T) => React.ReactNode } & Omit<ScrollViewProps, "children">) {
  const t = useTheme();
  const { data, error, refetch } = query;
  const pull = usePullToRefresh(refetch);
  useRefreshOnFocus(refetch);
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl {...pull} tintColor={t.tealText} colors={[t.teal]} />}
      contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 24 }}
      {...scrollProps}
    >
      {data === undefined ? (
        error ? (
          <ErrorState message={error.message} onRetry={() => refetch()} />
        ) : (
          <LoadingState />
        )
      ) : (
        <>
          {error && <InlineError message={error.message} onRetry={() => refetch()} />}
          {children(data)}
        </>
      )}
    </ScrollView>
  );
}
