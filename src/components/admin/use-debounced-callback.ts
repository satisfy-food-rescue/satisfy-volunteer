"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";

/** Wraps `fn` so it runs once the calls stop for `delay` ms, always with the
 *  latest `fn` (and so the latest props and search params). Pending calls are
 *  dropped on unmount or with `cancel()`. */
export function useDebouncedCallback<A extends unknown[]>(fn: (...args: A) => void, delay = 250) {
  const latest = useRef(fn);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useLayoutEffect(() => {
    latest.current = fn;
  });
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  return useMemo(() => {
    const cancel = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };
    const run = (...args: A) => {
      cancel();
      timer.current = setTimeout(() => {
        timer.current = null;
        latest.current(...args);
      }, delay);
    };
    return { run, cancel };
  }, [delay]);
}
