import { useId, type ReactNode } from "react";
import StatusDot from "../../components/StatusDot.tsx";
import { classNames } from "../../utils/classNames.ts";
import type { SettingStatus } from "./designModel.ts";
import { secondaryButtonClasses } from "./settingsStyles.ts";

export type SettingOwner = "theme" | "addOn";

const defaultLabels: Record<SettingOwner, string> = {
  theme: "Theme default",
  addOn: "Add-on default",
};

const ownerNames: Record<SettingOwner, string> = {
  theme: "your theme",
  addOn: "this add-on",
};

export type SettingFieldIds = {
  controlId: string;
  labelId: string;
  describedBy: string | undefined;
};

type SettingFieldFrameProps = {
  name: string;
  label: string;
  description: string | null;
  status: SettingStatus;
  owner: SettingOwner;
  isLabelForControl: boolean;
  renderLeading?: (ids: SettingFieldIds) => ReactNode;
  renderControl: (ids: SettingFieldIds) => ReactNode;
  onReset: () => void;
};

const SettingFieldFrame = ({
  name,
  label,
  description,
  status,
  owner,
  isLabelForControl,
  renderLeading,
  renderControl,
  onReset,
}: SettingFieldFrameProps) => {
  const baseId = useId();
  const descriptionId = `${baseId}-description`;
  const noticeId = `${baseId}-notice`;
  const ids: SettingFieldIds = {
    controlId: `${baseId}-control`,
    labelId: `${baseId}-label`,
    describedBy:
      [
        description === null ? null : descriptionId,
        status.isRejected ? noticeId : null,
      ]
        .filter((id) => id !== null)
        .join(" ") || undefined,
  };
  const isChanged = status.isStored && !status.isRejected;
  const labelClasses = "text-ink text-sm font-medium";

  return (
    <div
      role="group"
      aria-labelledby={ids.labelId}
      data-setting={name}
      className="border-line flex flex-col gap-2 rounded-md border p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        {renderLeading?.(ids)}
        {isLabelForControl ? (
          <label
            id={ids.labelId}
            htmlFor={ids.controlId}
            className={labelClasses}
          >
            {label}
          </label>
        ) : (
          <span id={ids.labelId} className={labelClasses}>
            {label}
          </span>
        )}
        <span
          data-testid="setting-status"
          className={classNames(
            "flex items-center gap-1.5 text-xs",
            isChanged ? "text-primary-ink" : "text-ink-muted",
          )}
        >
          <StatusDot tone={isChanged ? "progress" : "quiet"} />
          {isChanged ? "Changed" : defaultLabels[owner]}
        </span>
        {status.isStored && (
          <button
            type="button"
            aria-label={`Reset ${label}`}
            onClick={onReset}
            className={classNames(secondaryButtonClasses, "ml-auto")}
          >
            Reset
          </button>
        )}
      </div>
      {description !== null && (
        <p id={descriptionId} className="text-ink-muted text-xs">
          {description}
        </p>
      )}
      {status.isRejected && (
        <p id={noticeId} className="text-danger text-sm">
          The saved choice for {label} isn’t one {ownerNames[owner]} accepts, so{" "}
          {ownerNames[owner]}’s default is used instead. Reset it, or pick
          something new.
        </p>
      )}
      {renderControl(ids)}
    </div>
  );
};

export default SettingFieldFrame;
