import { useEffect, useState } from "react";
import type {
  JsonValue,
  SiteConfigSnapshot,
  SiteInspection,
} from "../../../electron/ipcContract.cts";
import {
  ArrowLeftIcon,
  CloseIcon,
  PlusIcon,
  SlidersIcon,
} from "../../components/Icons.tsx";
import AddFromAddressModal from "./AddFromAddressModal.tsx";
import AddOnCard from "./AddOnCard.tsx";
import { addOnCatalog, addOnTitleFor } from "./addOnCatalog.ts";
import AddOnProvides from "./AddOnProvides.tsx";
import AddOnRemoveButton from "./AddOnRemoveButton.tsx";
import AddOnSettingsView from "./AddOnSettingsView.tsx";
import {
  addOnStatusFor,
  blockLabelsFor,
  enabledAddOnsFrom,
  hasAddOnSettings,
  pluginDetailFor,
  pluginStoredSettings,
} from "./addOnsModel.ts";
import RemoveAddOnModal from "./RemoveAddOnModal.tsx";
import SettingsSection from "./SettingsSection.tsx";
import {
  backButtonClasses,
  iconButtonClasses,
  secondaryButtonClasses,
} from "./settingsStyles.ts";

type AddOnsPaneProps = {
  sitePath: string;
  snapshot: SiteConfigSnapshot | null;
  inspection: SiteInspection | null;
  onPluginsChanged: () => Promise<void>;
  onPluginSettingChanged: (
    name: string,
    setting: string,
    value: JsonValue | undefined,
  ) => Promise<string | null>;
  onCloseRequested: () => void;
};

type RemovalTarget = {
  name: string;
  title: string;
};

const catalogNames = new Set(addOnCatalog.map((addOn) => addOn.name));

async function onlineAvailabilityOf(name: string): Promise<[string, boolean]> {
  return [
    name,
    await globalThis.nefantaris.invoke("plugins:checkAvailable", name),
  ];
}

const AddOnsPane = ({
  sitePath,
  snapshot,
  inspection,
  onPluginsChanged,
  onPluginSettingChanged,
  onCloseRequested,
}: AddOnsPaneProps) => {
  const [onlineAvailability, setOnlineAvailability] = useState<
    Record<string, boolean>
  >({});
  const [addingName, setAddingName] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [removalTarget, setRemovalTarget] = useState<RemovalTarget | null>(
    null,
  );
  const [isAddFromAddressOpen, setIsAddFromAddressOpen] = useState(false);
  const [openedName, setOpenedName] = useState<string | null>(null);

  const config = snapshot?.status === "ok" ? snapshot.config : null;
  const enabledAddOns =
    config === null ? [] : enabledAddOnsFrom(config, inspection);
  const otherAddOns = enabledAddOns.filter(
    (addOn) => !catalogNames.has(addOn.name),
  );
  const isLocked = addingName !== null;
  const openedDetail =
    openedName !== null &&
    enabledAddOns.some((addOn) => addOn.name === openedName)
      ? pluginDetailFor(inspection, openedName)
      : undefined;
  const openedTitle =
    openedDetail === undefined ? null : addOnTitleFor(openedDetail.name);
  const hasDarkLook = inspection?.themeModes?.includes("dark") ?? false;

  const addCatalogAddOn = async (name: string) => {
    setAddingName(name);
    setErrors(({ [name]: _cleared, ...rest }) => rest);
    const result = await globalThis.nefantaris.invoke(
      "plugins:add",
      sitePath,
      name,
    );
    if (result.status === "failed") {
      setErrors((current) => ({ ...current, [name]: result.message }));
    } else {
      await onPluginsChanged();
    }
    setAddingName(null);
  };

  const removeAddOn = async (name: string): Promise<string | null> => {
    const result = await globalThis.nefantaris.invoke(
      "plugins:remove",
      sitePath,
      name,
    );
    if (result.status === "failed") {
      return result.message;
    }
    await onPluginsChanged();
    setRemovalTarget(null);
    return null;
  };

  const finishAddFromAddress = () => {
    setIsAddFromAddressOpen(false);
    void onPluginsChanged();
  };

  useEffect(() => {
    const checkOnlineAddOns = async () => {
      const names = addOnCatalog
        .filter((addOn) => addOn.availability === "checkOnline")
        .map((addOn) => addOn.name);
      const results = await Promise.all(names.map(onlineAvailabilityOf));
      setOnlineAvailability(Object.fromEntries(results));
    };
    void checkOnlineAddOns();
  }, []);

  return (
    <div className="@container h-full overflow-y-auto">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 p-6">
        <div className="flex items-start justify-between gap-3">
          {openedTitle === null ? (
            <div className="flex flex-col gap-1">
              <h1 className="text-ink text-xl font-semibold">Add-ons</h1>
              <p className="text-ink-muted text-sm">
                Add-ons give your site extra abilities. Add one and your theme
                can start using it.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setOpenedName(null)}
                className={backButtonClasses}
              >
                <ArrowLeftIcon />
                All add-ons
              </button>
              <h1 className="text-ink text-xl font-semibold">{openedTitle}</h1>
            </div>
          )}
          <button
            type="button"
            aria-label="Close add-ons"
            onClick={onCloseRequested}
            className={iconButtonClasses}
          >
            <CloseIcon />
          </button>
        </div>
        {snapshot?.status === "missing" && (
          <p role="alert" className="text-danger text-sm">
            This site&rsquo;s settings file is missing, so add-ons can&rsquo;t
            be shown here.
          </p>
        )}
        {snapshot?.status === "unreadable" && (
          <p role="alert" className="text-danger text-sm">
            Your site&rsquo;s settings couldn&rsquo;t be read, so add-ons
            can&rsquo;t be shown here. Fix the settings file, or go back to an
            earlier version, and they will show up again.
          </p>
        )}
        {config !== null && openedDetail !== undefined && (
          <AddOnSettingsView
            key={openedDetail.name}
            sitePath={sitePath}
            title={openedTitle ?? openedDetail.name}
            detail={openedDetail}
            stored={pluginStoredSettings(config, openedDetail.name)}
            blockLabels={blockLabelsFor(inspection, openedDetail)}
            hasDarkLook={hasDarkLook}
            onSettingChanged={(setting, value) =>
              onPluginSettingChanged(openedDetail.name, setting, value)
            }
          />
        )}
        {config !== null && openedDetail === undefined && (
          <>
            <SettingsSection title="Nefantaris add-ons">
              <ul className="grid grid-cols-1 gap-3 @xl:grid-cols-2 @5xl:grid-cols-3">
                {addOnCatalog.map((addOn) => {
                  const enabled = enabledAddOns.find(
                    (candidate) => candidate.name === addOn.name,
                  );
                  const detail = pluginDetailFor(inspection, addOn.name);
                  return (
                    <AddOnCard
                      key={addOn.name}
                      addOn={addOn}
                      status={addOnStatusFor(
                        addOn,
                        enabled,
                        onlineAvailability[addOn.name],
                      )}
                      enabled={enabled}
                      detail={detail}
                      blockLabels={
                        detail === undefined
                          ? []
                          : blockLabelsFor(inspection, detail)
                      }
                      isAdding={addingName === addOn.name}
                      isLocked={isLocked}
                      error={errors[addOn.name]}
                      onAddRequested={() => void addCatalogAddOn(addOn.name)}
                      onRemoveRequested={() =>
                        setRemovalTarget({
                          name: addOn.name,
                          title: addOn.title,
                        })
                      }
                      onSettingsRequested={() => setOpenedName(addOn.name)}
                    />
                  );
                })}
              </ul>
            </SettingsSection>
            {otherAddOns.length > 0 && (
              <SettingsSection
                title="Other add-ons"
                description="Add-ons your site uses that come from somewhere else."
              >
                <ul className="flex flex-col gap-1">
                  {otherAddOns.map((addOn) => {
                    const detail = pluginDetailFor(inspection, addOn.name);
                    return (
                      <li
                        key={addOn.name}
                        className="bg-sunken flex flex-col gap-2 rounded-md px-3 py-2 text-sm"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <span className="flex flex-col py-1.5">
                            <span className="text-ink font-medium break-all">
                              {addOn.name}
                            </span>
                            {addOn.version !== null && (
                              <span className="text-ink-muted">
                                {`Version ${addOn.version}`}
                              </span>
                            )}
                          </span>
                          <div className="flex flex-wrap items-start gap-2">
                            {hasAddOnSettings(detail) && (
                              <button
                                type="button"
                                aria-label={`Settings for ${addOn.name}`}
                                onClick={() => setOpenedName(addOn.name)}
                                className={secondaryButtonClasses}
                              >
                                <SlidersIcon />
                                Settings
                              </button>
                            )}
                            <AddOnRemoveButton
                              title={addOn.name}
                              isRequiredByTheme={addOn.isRequiredByTheme}
                              isDisabled={isLocked}
                              onRemoveRequested={() =>
                                setRemovalTarget({
                                  name: addOn.name,
                                  title: addOn.name,
                                })
                              }
                            />
                          </div>
                        </div>
                        {detail !== undefined && detail.error !== null && (
                          <p role="alert" className="text-danger">
                            {`This add-on couldn’t be loaded: ${detail.error}`}
                          </p>
                        )}
                        {detail !== undefined && (
                          <AddOnProvides
                            title={addOn.name}
                            detail={detail}
                            blockLabels={blockLabelsFor(inspection, detail)}
                          />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </SettingsSection>
            )}
            <div className="flex flex-col items-start gap-2">
              <button
                type="button"
                disabled={isLocked}
                onClick={() => setIsAddFromAddressOpen(true)}
                className={secondaryButtonClasses}
              >
                <PlusIcon />
                Add from an address
              </button>
              <p className="text-ink-muted text-sm">
                For an add-on someone shared with you.
              </p>
            </div>
          </>
        )}
      </div>
      {removalTarget !== null && (
        <RemoveAddOnModal
          title={removalTarget.title}
          onConfirm={() => removeAddOn(removalTarget.name)}
          onClose={() => setRemovalTarget(null)}
        />
      )}
      {isAddFromAddressOpen && (
        <AddFromAddressModal
          sitePath={sitePath}
          onAdded={finishAddFromAddress}
          onClose={() => setIsAddFromAddressOpen(false)}
        />
      )}
    </div>
  );
};

export default AddOnsPane;
