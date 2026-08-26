const MAX_TIMEOUT_MS = 2_147_483_647;

export function safeTimeout<TArgs extends unknown[]>(
  callback: (...callbackArgs: TArgs) => void,
  delay: number,
  ...args: TArgs
): ReturnType<typeof globalThis.setTimeout> {
  if (delay > MAX_TIMEOUT_MS) {
    console.error(
      `safeTimeout: delay ${delay} exceeds the maximum of ${MAX_TIMEOUT_MS} ms (~24.8 days). Using the maximum value.`,
    );
    delay = MAX_TIMEOUT_MS;
  }
  return globalThis.setTimeout(callback, delay, ...args);
}
