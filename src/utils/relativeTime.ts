const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 1000 * 60 * 60 * 24 * 365],
  ["month", 1000 * 60 * 60 * 24 * 30],
  ["week", 1000 * 60 * 60 * 24 * 7],
  ["day", 1000 * 60 * 60 * 24],
  ["hour", 1000 * 60 * 60],
  ["minute", 1000 * 60],
];

export function relativeTimeFrom(
  timestampMs: number,
  nowMs = Date.now(),
): string {
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const elapsed = timestampMs - nowMs;
  for (const [unit, unitMs] of UNITS) {
    if (Math.abs(elapsed) >= unitMs) {
      return formatter.format(Math.round(elapsed / unitMs), unit);
    }
  }
  return "just now";
}
