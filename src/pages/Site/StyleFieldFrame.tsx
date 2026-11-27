import type { PropsWithChildren } from "react";
import StatusDot from "../../components/StatusDot.tsx";
import { classNames } from "../../utils/classNames.ts";
import { statusBadgeText, type StyleFieldStatus } from "./styleValues.ts";

type StyleFieldFrameProps = PropsWithChildren<{
  label: string;
  resetLabel: string;
  labelId: string;
  controlId: string | null;
  status: StyleFieldStatus;
  onReset: () => void;
}>;

const StyleFieldFrame = ({
  label,
  resetLabel,
  labelId,
  controlId,
  status,
  onReset,
  children,
}: StyleFieldFrameProps) => {
  const badge = statusBadgeText(status);
  const labelClasses = "text-ink text-sm font-medium";

  return (
    <div
      role="group"
      aria-labelledby={labelId}
      data-style-field={resetLabel}
      className="flex flex-col gap-1.5"
    >
      <div className="flex min-h-7 flex-wrap items-center gap-2">
        {controlId === null ? (
          <span id={labelId} className={labelClasses}>
            {label}
          </span>
        ) : (
          <label id={labelId} htmlFor={controlId} className={labelClasses}>
            {label}
          </label>
        )}
        {badge !== null && (
          <span
            data-testid="style-field-status"
            className={classNames(
              "flex items-center gap-1.5 text-xs",
              status.isSet ? "text-primary-ink" : "text-ink-muted",
            )}
          >
            <StatusDot tone={status.isSet ? "progress" : "quiet"} />
            {badge}
          </span>
        )}
        {status.isSet && (
          <button
            type="button"
            aria-label={`Reset ${resetLabel}`}
            onClick={onReset}
            className="text-ink-secondary hover:text-ink hover:bg-raised ml-auto rounded-md px-2 py-0.5 text-xs font-medium transition-colors duration-100"
          >
            Reset
          </button>
        )}
      </div>
      {children}
    </div>
  );
};

export default StyleFieldFrame;
