import { useId } from "react";
import type { PluginDetail } from "../../../electron/ipcContract.cts";
import {
  ExternalLinkIcon,
  PlusIcon,
  SlidersIcon,
} from "../../components/Icons.tsx";
import StatusDot, { type StatusTone } from "../../components/StatusDot.tsx";
import type { CatalogAddOn } from "./addOnCatalog.ts";
import AddOnProvides from "./AddOnProvides.tsx";
import AddOnRemoveButton from "./AddOnRemoveButton.tsx";
import {
  addOnStatusLabels,
  hasAddOnSettings,
  hasProvides,
  type AddOnStatus,
  type EnabledAddOn,
} from "./addOnsModel.ts";
import {
  primaryButtonClasses,
  secondaryButtonClasses,
} from "./settingsStyles.ts";

type AddOnCardProps = {
  addOn: CatalogAddOn;
  status: AddOnStatus;
  enabled: EnabledAddOn | undefined;
  detail: PluginDetail | undefined;
  blockLabels: string[];
  isAdding: boolean;
  isLocked: boolean;
  error: string | undefined;
  onAddRequested: () => void;
  onRemoveRequested: () => void;
  onSettingsRequested: () => void;
};

const statusTones: Record<AddOnStatus, StatusTone> = {
  added: "positive",
  requiredByTheme: "positive",
  available: "quiet",
  comingSoon: "quiet",
  checking: "progress",
};

const AddOnCard = ({
  addOn,
  status,
  enabled,
  detail,
  blockLabels,
  isAdding,
  isLocked,
  error,
  onAddRequested,
  onRemoveRequested,
  onSettingsRequested,
}: AddOnCardProps) => {
  const titleId = useId();
  const liveDetail = enabled === undefined ? undefined : detail;
  const isLiveSummaryShown =
    liveDetail !== undefined && hasProvides(liveDetail);

  return (
    <li className="flex">
      <article
        aria-labelledby={titleId}
        className="bg-sunken flex w-full flex-col gap-3 rounded-md p-4"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 id={titleId} className="text-ink text-base font-medium">
            {addOn.title}
          </h3>
          <span
            data-testid="add-on-status"
            className="text-ink-secondary flex shrink-0 items-center gap-1.5 py-0.5 text-xs font-medium"
          >
            <StatusDot tone={statusTones[status]} />
            {addOnStatusLabels[status]}
          </span>
        </div>
        <p className="text-ink-secondary text-sm">{addOn.description}</p>
        {liveDetail !== undefined && liveDetail.error !== null && (
          <p role="alert" className="text-danger text-sm">
            {`This add-on couldn’t be loaded: ${liveDetail.error}`}
          </p>
        )}
        {isLiveSummaryShown ? (
          <AddOnProvides
            title={addOn.title}
            detail={liveDetail}
            blockLabels={blockLabels}
          />
        ) : (
          <p className="text-ink-muted text-sm">
            <span className="text-ink-secondary font-medium">Adds: </span>
            {addOn.adds}
          </p>
        )}
        {enabled !== undefined && enabled.version !== null && (
          <p className="text-ink-muted text-sm">{`Version ${enabled.version}`}</p>
        )}
        <div className="mt-auto flex flex-wrap items-start justify-between gap-3 pt-1">
          {status === "available" && (
            <button
              type="button"
              aria-label={`${isAdding ? "Adding" : "Add"} ${addOn.title}`}
              disabled={isLocked}
              onClick={onAddRequested}
              className={primaryButtonClasses}
            >
              <PlusIcon />
              {isAdding ? "Adding…" : "Add"}
            </button>
          )}
          {(status === "added" || status === "requiredByTheme") && (
            <div className="flex flex-wrap items-start gap-2">
              {hasAddOnSettings(liveDetail) && (
                <button
                  type="button"
                  aria-label={`Settings for ${addOn.title}`}
                  onClick={onSettingsRequested}
                  className={secondaryButtonClasses}
                >
                  <SlidersIcon />
                  Settings
                </button>
              )}
              <AddOnRemoveButton
                title={addOn.title}
                isRequiredByTheme={status === "requiredByTheme"}
                isDisabled={isLocked}
                onRemoveRequested={onRemoveRequested}
              />
            </div>
          )}
          {status === "comingSoon" && (
            <p className="text-ink-muted text-sm">
              Not ready to add yet. Check back soon.
            </p>
          )}
          <button
            type="button"
            aria-label={`Learn more about ${addOn.title}`}
            onClick={() =>
              void globalThis.nefantaris.invoke(
                "system:openExternal",
                addOn.repositoryUrl,
              )
            }
            className="text-primary-ink inline-flex items-center gap-1 rounded-md py-1.5 text-sm font-medium hover:underline"
          >
            Learn more
            <ExternalLinkIcon />
          </button>
        </div>
        {error !== undefined && (
          <p role="alert" className="text-danger text-sm">
            {error}
          </p>
        )}
      </article>
    </li>
  );
};

export default AddOnCard;
