import { classNames } from "../utils/classNames.ts";

export type StatusTone =
  "positive" | "attention" | "progress" | "quiet" | "negative";

type StatusDotProps = {
  tone: StatusTone;
};

const toneClasses: Record<StatusTone, string> = {
  positive: "bg-success",
  attention: "bg-warning",
  progress: "bg-primary",
  quiet: "border-ink-muted border",
  negative: "bg-danger",
};

const StatusDot = ({ tone }: StatusDotProps) => (
  <span
    aria-hidden="true"
    className={classNames(
      "inline-block size-2 shrink-0 rounded-full",
      toneClasses[tone],
    )}
  />
);

export default StatusDot;
