import type {
  ContentTree,
  SiteConfigEdit,
  SiteConfigSnapshot,
  SiteInspection,
} from "../../../electron/ipcContract.cts";
import { CloseIcon } from "../../components/Icons.tsx";
import AutosaveTextField from "./AutosaveTextField.tsx";
import FaviconSettings from "./FaviconSettings.tsx";
import ImageChooser from "./ImageChooser.tsx";
import ModesSettings from "./ModesSettings.tsx";
import NavigationEditor from "./NavigationEditor.tsx";
import SettingsSection from "./SettingsSection.tsx";
import {
  canonicalLanguage,
  canonicalSiteAddress,
  languageProblem,
  linkOptionsFrom,
  siteAddressProblem,
  siteNameProblem,
  textSetting,
  textSettingEdits,
} from "./siteSettingsModel.ts";

type SiteSettingsPaneProps = {
  sitePath: string;
  snapshot: SiteConfigSnapshot | null;
  tree: ContentTree | null;
  inspection: SiteInspection | null;
  onEdit: (edits: SiteConfigEdit[]) => void;
  onCloseRequested: () => void;
};

const SiteSettingsPane = ({
  sitePath,
  snapshot,
  tree,
  inspection,
  onEdit,
  onCloseRequested,
}: SiteSettingsPaneProps) => {
  const config = snapshot?.status === "ok" ? snapshot.config : null;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-3xl flex-col gap-8 p-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-ink text-xl font-semibold">Site settings</h1>
          <button
            type="button"
            aria-label="Close site settings"
            onClick={onCloseRequested}
            className="text-ink-muted hover:text-ink hover:bg-raised rounded-md p-1.5 transition-colors duration-100"
          >
            <CloseIcon />
          </button>
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
            version, and your settings will show up here again.
          </p>
        )}
        {config !== null && (
          <>
            <SettingsSection title="General">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <AutosaveTextField
                  label="Site name"
                  value={textSetting(config, "name")}
                  validate={siteNameProblem}
                  onCommit={(value) =>
                    onEdit([
                      { kind: "set", path: ["name"], value: value.trim() },
                    ])
                  }
                  className="sm:col-span-2"
                />
                <AutosaveTextField
                  label="Site address"
                  value={textSetting(config, "url")}
                  placeholder="https://example.com"
                  hint="The web address your site is published at. Leave it empty until your site is online."
                  validate={siteAddressProblem}
                  onCommit={(value) =>
                    onEdit(textSettingEdits("url", canonicalSiteAddress(value)))
                  }
                />
                <AutosaveTextField
                  label="Language"
                  value={textSetting(config, "lang")}
                  placeholder="en"
                  hint="The language your site is written in, as a short code like en, fr, or pt-BR. Empty means English."
                  validate={languageProblem}
                  onCommit={(value) =>
                    onEdit(textSettingEdits("lang", canonicalLanguage(value)))
                  }
                />
              </div>
            </SettingsSection>
            <SettingsSection
              title="Navigation"
              description="The links in your site’s menu, in the order they appear."
            >
              <NavigationEditor
                nav={config.nav}
                linkOptions={linkOptionsFrom(tree)}
                onEdit={onEdit}
              />
            </SettingsSection>
            <SettingsSection
              title="Light and dark"
              description="Which looks your site offers, and which one visitors see first."
            >
              <ModesSettings
                config={config}
                themeModes={inspection?.themeModes ?? null}
                isThemeLoaded={inspection !== null}
                onEdit={onEdit}
              />
            </SettingsSection>
            <SettingsSection
              title="Share image"
              description="The picture shown when someone shares a link to your site."
            >
              <ImageChooser
                sitePath={sitePath}
                image={textSetting(config, "image")}
                noun="share image"
                emptyText="No share image yet"
                pickerTitle="Choose a share image"
                fileInputTestId="share-image-file"
                onImageChanged={(image) =>
                  onEdit(textSettingEdits("image", image))
                }
              />
            </SettingsSection>
            <SettingsSection
              title="Site icon"
              description="The small picture shown in browser tabs and bookmarks."
            >
              <FaviconSettings sitePath={sitePath} />
            </SettingsSection>
          </>
        )}
      </div>
    </div>
  );
};

export default SiteSettingsPane;
