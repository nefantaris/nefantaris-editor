import { useState } from "react";
import type {
  JsonValue,
  SiteConfigEdit,
  SiteConfigSnapshot,
  SiteInspection,
} from "../../../electron/ipcContract.cts";
import { CloseIcon } from "../../components/Icons.tsx";
import ModalDialog from "../../components/ModalDialog.tsx";
import {
  hasStoredSettings,
  resetAllEdits,
  settingGroupsFrom,
  settingValueEdits,
  storedSettingsFrom,
  unknownSettingNames,
} from "./designModel.ts";
import DesignSettingField from "./DesignSettingField.tsx";
import SettingsSection from "./SettingsSection.tsx";
import {
  iconButtonClasses,
  modalPrimaryButtonClasses,
  modalSecondaryButtonClasses,
  secondaryButtonClasses,
} from "./settingsStyles.ts";

type DesignPaneProps = {
  sitePath: string;
  snapshot: SiteConfigSnapshot | null;
  inspection: SiteInspection | null;
  onEdit: (edits: SiteConfigEdit[]) => void;
  onRecheckRequested: () => void;
  onCloseRequested: () => void;
};

type ResetAllModalProps = {
  onConfirm: () => void;
  onClose: () => void;
};

const ResetAllModal = ({ onConfirm, onClose }: ResetAllModalProps) => (
  <ModalDialog title="Reset every design choice?" onClose={onClose}>
    <p className="text-ink-secondary text-sm">
      Every choice on this page goes back to your theme&rsquo;s default.
    </p>
    <div className="flex flex-col gap-3 sm:flex-row">
      <button
        type="button"
        onClick={onConfirm}
        className={modalPrimaryButtonClasses}
      >
        Reset all
      </button>
      <button
        type="button"
        onClick={onClose}
        className={modalSecondaryButtonClasses}
      >
        Cancel
      </button>
    </div>
  </ModalDialog>
);

const DesignPane = ({
  sitePath,
  snapshot,
  inspection,
  onEdit,
  onRecheckRequested,
  onCloseRequested,
}: DesignPaneProps) => {
  const [isResetAllOpen, setIsResetAllOpen] = useState(false);
  const [resetCount, setResetCount] = useState(0);

  const config = snapshot?.status === "ok" ? snapshot.config : null;
  const stored = config === null ? null : storedSettingsFrom(config);
  const storedValues = stored?.status === "ok" ? stored.values : {};
  const settings =
    inspection === null || inspection.isFallback
      ? null
      : (inspection.settings ?? {});
  const groups = settings === null ? [] : settingGroupsFrom(settings);
  const unknownNames =
    settings === null ? [] : unknownSettingNames(storedValues, settings);
  const hasDarkLook = inspection?.themeModes?.includes("dark") ?? false;
  const canResetAll = config !== null && hasStoredSettings(config);
  const areFieldsShown = stored?.status === "ok" && settings !== null;
  const ungroupedTitle = groups.some((group) => group.title !== null)
    ? "Other"
    : "General";

  const changeSetting = (name: string, value: JsonValue | undefined) => {
    onEdit(settingValueEdits(storedValues, name, value));
  };

  const resetAll = () => {
    if (config !== null) {
      onEdit(resetAllEdits(config));
    }
    setIsResetAllOpen(false);
    setResetCount((count) => count + 1);
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-3xl flex-col gap-8 p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-ink text-xl font-semibold">Design</h1>
            <p className="text-ink-muted text-sm">
              The choices your theme offers for how your site looks. Changes
              show in the preview as you make them.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {canResetAll && (
              <button
                type="button"
                onClick={() => setIsResetAllOpen(true)}
                className={secondaryButtonClasses}
              >
                Reset all
              </button>
            )}
            <button
              type="button"
              aria-label="Close design"
              onClick={onCloseRequested}
              className={iconButtonClasses}
            >
              <CloseIcon />
            </button>
          </div>
        </div>
        {snapshot?.status === "missing" && (
          <p role="alert" className="text-danger text-sm">
            This site&rsquo;s settings file is missing, so there&rsquo;s nothing
            to show here.
          </p>
        )}
        {snapshot?.status === "unreadable" && (
          <p role="alert" className="text-danger text-sm">
            Your site&rsquo;s settings couldn&rsquo;t be read. The settings file
            may have a typing mistake in it. Fix it, or go back to an earlier
            version, and your design choices will show up here again.
          </p>
        )}
        {config !== null && inspection === null && (
          <p className="text-ink-muted text-sm">Checking your theme…</p>
        )}
        {config !== null && inspection?.isFallback === true && (
          <div className="flex flex-col items-start gap-3">
            <p role="status" className="text-ink-secondary text-sm">
              Your theme couldn&rsquo;t be read right now, so its design choices
              can&rsquo;t be shown. Check that the preview starts, then try
              again.
            </p>
            <button
              type="button"
              onClick={onRecheckRequested}
              className={secondaryButtonClasses}
            >
              Check again
            </button>
          </div>
        )}
        {config !== null && settings !== null && groups.length === 0 && (
          <p role="status" className="text-ink-secondary text-sm">
            Your theme doesn&rsquo;t offer any design choices, so there&rsquo;s
            nothing to change here.
          </p>
        )}
        {stored?.status === "unreadable" && (
          <p role="alert" className="text-danger text-sm">
            Your saved design choices are in a shape that can&rsquo;t be read,
            so your theme&rsquo;s defaults are shown. Use &ldquo;Reset
            all&rdquo; to start over from your theme&rsquo;s defaults.
          </p>
        )}
        {unknownNames.length > 0 && (
          <SettingsSection
            title="Choices your theme doesn’t have"
            description="These were saved for your site, but your theme doesn’t offer them, so they have no effect."
          >
            <ul className="flex flex-col gap-2">
              {unknownNames.map((name) => (
                <li
                  key={name}
                  className="border-line flex items-center justify-between gap-3 rounded-md border p-3"
                >
                  <span className="text-ink-secondary text-sm">
                    &ldquo;{name}&rdquo; isn&rsquo;t a choice your theme offers.
                  </span>
                  <button
                    type="button"
                    aria-label={`Reset ${name}`}
                    onClick={() => changeSetting(name, undefined)}
                    className={secondaryButtonClasses}
                  >
                    Reset
                  </button>
                </li>
              ))}
            </ul>
          </SettingsSection>
        )}
        {areFieldsShown &&
          groups.map((group) => (
            <SettingsSection
              key={group.title ?? ""}
              title={group.title ?? ungroupedTitle}
            >
              <div key={resetCount} className="flex flex-col gap-3">
                {group.names.map((name) => (
                  <DesignSettingField
                    key={name}
                    sitePath={sitePath}
                    name={name}
                    definition={settings[name]}
                    stored={
                      Object.hasOwn(storedValues, name)
                        ? storedValues[name]
                        : undefined
                    }
                    reported={inspection?.settingValues[name]}
                    owner="theme"
                    hasDarkLook={hasDarkLook}
                    onChange={(value) => changeSetting(name, value)}
                  />
                ))}
              </div>
            </SettingsSection>
          ))}
      </div>
      {isResetAllOpen && (
        <ResetAllModal
          onConfirm={resetAll}
          onClose={() => setIsResetAllOpen(false)}
        />
      )}
    </div>
  );
};

export default DesignPane;
