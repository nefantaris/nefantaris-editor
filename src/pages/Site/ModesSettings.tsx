import type {
  JsonObject,
  SiteConfigEdit,
  SiteMode,
} from "../../../electron/ipcContract.cts";
import type { SiteModeDefault } from "./siteSettingsModel.ts";
import {
  defaultModeEdits,
  modeChoicesFrom,
  offeredModeEdits,
} from "./siteSettingsModel.ts";

type ModesSettingsProps = {
  config: JsonObject;
  themeModes: SiteMode[] | null;
  isThemeLoaded: boolean;
  onEdit: (edits: SiteConfigEdit[]) => void;
};

const MODE_LABELS: Record<SiteMode, string> = {
  light: "Light",
  dark: "Dark",
};

const DEFAULT_LABELS: Record<SiteModeDefault, string> = {
  system: "Match the visitor’s device",
  light: "Light",
  dark: "Dark",
};

const ModesSettings = ({
  config,
  themeModes,
  isThemeLoaded,
  onEdit,
}: ModesSettingsProps) => {
  const choices =
    themeModes === null ? null : modeChoicesFrom(config, themeModes);
  const defaultOptions: SiteModeDefault[] =
    choices === null || choices.offered.length < 2
      ? []
      : ["system", ...choices.offered];

  return (
    <>
      {!isThemeLoaded && (
        <p className="text-ink-muted text-sm">Checking your theme…</p>
      )}
      {isThemeLoaded && themeModes === null && (
        <p className="text-ink-muted text-sm">
          Your theme&rsquo;s light and dark looks couldn&rsquo;t be read right
          now, so they can&rsquo;t be changed here.
        </p>
      )}
      {themeModes?.length === 1 && (
        <p className="text-ink-secondary text-sm">
          {`Your theme comes in a ${MODE_LABELS[themeModes[0]].toLowerCase()} look only, so there’s nothing to choose here.`}
        </p>
      )}
      {choices !== null && themeModes !== null && themeModes.length > 1 && (
        <div className="flex flex-col gap-4">
          <fieldset className="flex flex-col gap-2">
            <legend className="text-ink-secondary mb-1 text-xs font-medium">
              Looks your site offers
            </legend>
            {themeModes.map((mode) => {
              const isOffered = choices.offered.includes(mode);
              const isLastOffered = isOffered && choices.offered.length === 1;
              return (
                <label
                  key={mode}
                  className="text-ink-secondary flex items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={isOffered}
                    disabled={isLastOffered}
                    onChange={(event) =>
                      onEdit(
                        offeredModeEdits(
                          config,
                          themeModes,
                          mode,
                          event.target.checked,
                        ),
                      )
                    }
                    className="accent-primary h-4 w-4"
                  />
                  {MODE_LABELS[mode]}
                </label>
              );
            })}
          </fieldset>
          {defaultOptions.length > 0 ? (
            <fieldset className="flex flex-col gap-2">
              <legend className="text-ink-secondary mb-1 text-xs font-medium">
                What visitors see first
              </legend>
              {defaultOptions.map((option) => (
                <label
                  key={option}
                  className="text-ink-secondary flex items-center gap-2 text-sm"
                >
                  <input
                    type="radio"
                    name="site-default-mode"
                    checked={choices.defaultMode === option}
                    onChange={() => onEdit(defaultModeEdits(config, option))}
                    className="accent-primary h-4 w-4"
                  />
                  {DEFAULT_LABELS[option]}
                </label>
              ))}
            </fieldset>
          ) : (
            <p className="text-ink-muted text-sm">
              {`Visitors always see the ${DEFAULT_LABELS[choices.defaultMode].toLowerCase()} look.`}
            </p>
          )}
        </div>
      )}
    </>
  );
};

export default ModesSettings;
