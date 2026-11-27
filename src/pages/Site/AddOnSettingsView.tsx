import { useState } from "react";
import type {
  JsonValue,
  PluginDetail,
} from "../../../electron/ipcContract.cts";
import AddOnProvides from "./AddOnProvides.tsx";
import type { StoredSettings } from "./designModel.ts";
import { settingGroupsFrom, unknownSettingNames } from "./designModel.ts";
import DesignSettingField from "./DesignSettingField.tsx";
import DevVarsEditor from "./DevVarsEditor.tsx";
import SettingsSection from "./SettingsSection.tsx";
import { secondaryButtonClasses } from "./settingsStyles.ts";

type AddOnSettingsViewProps = {
  sitePath: string;
  title: string;
  detail: PluginDetail;
  stored: StoredSettings;
  blockLabels: string[];
  hasDarkLook: boolean;
  onSettingChanged: (
    setting: string,
    value: JsonValue | undefined,
  ) => Promise<string | null>;
};

const SecretsExplainer = () => (
  <div className="text-ink-secondary flex flex-col gap-2 text-sm">
    <p>
      This add-on runs code on your live site. Notification addresses and keys
      belong somewhere private, not in your pages or settings, which anyone can
      read once your site is published.
    </p>
    <ul className="flex list-disc flex-col gap-1 pl-5">
      <li>
        <span className="text-ink font-medium">For your live site:</span> add
        them as environment variables in your Cloudflare Pages project.
      </li>
      <li>
        <span className="text-ink font-medium">For the preview:</span> add them
        below. They&rsquo;re kept on this computer in a .dev.vars file that is
        never published.
      </li>
    </ul>
  </div>
);

const AddOnSettingsView = ({
  sitePath,
  title,
  detail,
  stored,
  blockLabels,
  hasDarkLook,
  onSettingChanged,
}: AddOnSettingsViewProps) => {
  const [saveError, setSaveError] = useState<string | null>(null);

  const storedValues = stored.status === "ok" ? stored.values : {};
  const groups = settingGroupsFrom(detail.settings);
  const unknownNames = unknownSettingNames(storedValues, detail.settings);
  const ungroupedTitle = groups.some((group) => group.title !== null)
    ? "Other settings"
    : "Settings";

  const changeSetting = async (name: string, value: JsonValue | undefined) => {
    setSaveError(await onSettingChanged(name, value));
  };

  return (
    <div className="flex flex-col gap-8">
      {detail.error !== null && (
        <p role="alert" className="text-danger text-sm">
          {`This add-on couldn’t be loaded: ${detail.error}`}
        </p>
      )}
      <AddOnProvides title={title} detail={detail} blockLabels={blockLabels} />
      {saveError !== null && (
        <p role="alert" className="text-danger text-sm">
          {saveError}
        </p>
      )}
      {stored.status === "unreadable" && (
        <p role="alert" className="text-danger text-sm">
          This add-on&rsquo;s saved settings are in a shape that can&rsquo;t be
          read, so its defaults are shown.
        </p>
      )}
      {unknownNames.length > 0 && (
        <SettingsSection
          title="Settings this add-on doesn’t have"
          description="These were saved for your site, but this add-on doesn’t offer them, so they have no effect."
        >
          <ul className="flex flex-col gap-2">
            {unknownNames.map((name) => (
              <li
                key={name}
                className="border-line flex items-center justify-between gap-3 rounded-md border p-3"
              >
                <span className="text-ink-secondary text-sm">
                  &ldquo;{name}&rdquo; isn&rsquo;t a setting this add-on offers.
                </span>
                <button
                  type="button"
                  aria-label={`Reset ${name}`}
                  onClick={() => void changeSetting(name, undefined)}
                  className={secondaryButtonClasses}
                >
                  Reset
                </button>
              </li>
            ))}
          </ul>
        </SettingsSection>
      )}
      {stored.status === "ok" &&
        groups.map((group) => (
          <SettingsSection
            key={group.title ?? ""}
            title={group.title ?? ungroupedTitle}
          >
            <div className="flex flex-col gap-3">
              {group.names.map((name) => (
                <DesignSettingField
                  key={name}
                  sitePath={sitePath}
                  name={name}
                  definition={detail.settings[name]}
                  stored={
                    Object.hasOwn(storedValues, name)
                      ? storedValues[name]
                      : undefined
                  }
                  reported={detail.settingValues[name]}
                  owner="addOn"
                  hasDarkLook={hasDarkLook}
                  onChange={(value) => void changeSetting(name, value)}
                />
              ))}
            </div>
          </SettingsSection>
        ))}
      {detail.functions.length > 0 && (
        <SettingsSection title="Keep secrets out of your site">
          <SecretsExplainer />
          <DevVarsEditor sitePath={sitePath} />
        </SettingsSection>
      )}
    </div>
  );
};

export default AddOnSettingsView;
