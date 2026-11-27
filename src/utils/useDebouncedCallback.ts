import { useEffect, useRef } from "react";

export type DebouncedCallback<Args extends unknown[]> = {
  schedule: (...args: Args) => void;
  flush: () => void;
  cancel: () => void;
};

export function useDebouncedCallback<Args extends unknown[]>(
  callback: (...args: Args) => void,
  delayMs: number,
): DebouncedCallback<Args> {
  const callbackRef = useRef(callback);
  const timerRef = useRef<number | null>(null);
  const pendingArgsRef = useRef<Args | null>(null);

  const cancel = () => {
    if (timerRef.current !== null) {
      globalThis.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingArgsRef.current = null;
  };

  const flush = () => {
    const pendingArgs = pendingArgsRef.current;
    cancel();
    if (pendingArgs !== null) {
      callbackRef.current(...pendingArgs);
    }
  };

  const schedule = (...args: Args) => {
    cancel();
    pendingArgsRef.current = args;
    timerRef.current = globalThis.setTimeout(flush, delayMs);
  };

  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    return flush;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { schedule, flush, cancel };
}
