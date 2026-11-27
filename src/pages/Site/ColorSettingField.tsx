import { useState } from "react";
import type {
  JsonValue,
  SiteMode,
  ThemeColorSetting,
  ThemeSettingValue,
} from "../../../electron/ipcContract.cts";
import { classNames } from "../../utils/classNames.ts";
import { useDebouncedCallback } from "../../utils/useDebouncedCallback.ts";
import {
  COLOR_MODES,
  colorChoice,
  colorInForce,
  expandedHex,
  hexWithHash,
  isHexColor,
  isSplitColorStored,
  settingStatus,
} from "./designModel.ts";
import SettingFieldFrame, { type SettingOwner } from "./SettingFieldFrame.tsx";

type ColorSettingFieldProps = {
  name: string;
  definition: ThemeColorSetting;
  stored: JsonValue | undefined;
  reported: ThemeSettingValue | undefined;
  owner: SettingOwner;
  hasDarkLook: boolean;
  onChange: (value: JsonValue | undefined) => void;
};

type ColorDrafts = Partial<Record<SiteMode, string>>;

const COMMIT_DELAY_MS = 300;

const MODE_LABELS: Record<SiteMode, string> = {
  light: "Light look",
  dark: "Dark look",
};

function isDraftValid(draft: string | undefined): boolean {
  return draft === undefined || isHexColor(hexWithHash(draft));
}

const ColorSettingField = ({
  name,
  definition,
  stored,
  reported,
  owner,
  hasDarkLook,
  onChange,
}: ColorSettingFieldProps) => {
  const [drafts, setDrafts] = useState<ColorDrafts>({});
  const [splitChoice, setSplitChoice] = useState<boolean | null>(null);
  const [isSettled, setIsSettled] = useState(true);

  const status = settingStatus(definition, stored);
  const inForce = colorInForce(definition, stored, reported);
  const isSplit =
    hasDarkLook && (splitChoice ?? isSplitColorStored(definition, stored));
  const shownModes: SiteMode[] = isSplit ? COLOR_MODES : ["light"];

  const resolvedHex = (candidate: ColorDrafts, mode: SiteMode): string => {
    const draft = candidate[mode];
    return draft === undefined ? inForce[mode] : hexWithHash(draft);
  };

  const commitDrafts = (candidate: ColorDrafts, isSplitCommit: boolean) => {
    setIsSettled(true);
    if (COLOR_MODES.some((mode) => !isDraftValid(candidate[mode]))) {
      return;
    }
    const light = resolvedHex(candidate, "light");
    const dark = isSplitCommit ? resolvedHex(candidate, "dark") : light;
    onChange(
      colorChoice(definition, { light, dark }, isSplitCommit, hasDarkLook),
    );
    setDrafts({});
  };

  const debouncedCommit = useDebouncedCallback(commitDrafts, COMMIT_DELAY_MS);

  const changeMode = (mode: SiteMode, text: string) => {
    const next = { ...drafts, [mode]: text };
    setDrafts(next);
    setIsSettled(false);
    debouncedCommit.schedule(next, isSplit);
  };

  const changeSplit = (nextIsSplit: boolean) => {
    debouncedCommit.cancel();
    setSplitChoice(nextIsSplit);
    if (!nextIsSplit || Object.keys(drafts).length > 0) {
      commitDrafts(drafts, nextIsSplit);
    }
  };

  const reset = () => {
    debouncedCommit.cancel();
    setDrafts({});
    setSplitChoice(null);
    setIsSettled(true);
    onChange(undefined);
  };

  return (
    <SettingFieldFrame
      name={name}
      label={definition.label}
      description={definition.description}
      status={status}
      owner={owner}
      isLabelForControl={false}
      onReset={reset}
      renderControl={(ids) => (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {shownModes.map((mode) => {
              const text = drafts[mode] ?? inForce[mode];
              const isInvalid = isSettled && !isDraftValid(drafts[mode]);
              const errorId = `${ids.controlId}-${mode}-error`;
              const lookSuffix = isSplit
                ? `, ${MODE_LABELS[mode].toLowerCase()}`
                : "";
              return (
                <div key={mode} className="flex flex-col gap-1">
                  {isSplit && (
                    <span className="text-ink-secondary text-xs font-medium">
                      {MODE_LABELS[mode]}
                    </span>
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      aria-label={`${definition.label}${lookSuffix}`}
                      aria-describedby={ids.describedBy}
                      value={expandedHex(
                        isDraftValid(drafts[mode])
                          ? resolvedHex(drafts, mode)
                          : inForce[mode],
                      )}
                      onChange={(event) => changeMode(mode, event.target.value)}
                      onBlur={debouncedCommit.flush}
                      className="border-line bg-surface h-9 w-12 shrink-0 cursor-pointer rounded-md border p-0.5"
                    />
                    <input
                      type="text"
                      aria-label={`${definition.label} code${lookSuffix}`}
                      aria-invalid={isInvalid || undefined}
                      aria-describedby={isInvalid ? errorId : ids.describedBy}
                      spellCheck={false}
                      value={text}
                      onChange={(event) => changeMode(mode, event.target.value)}
                      onBlur={debouncedCommit.flush}
                      className={classNames(
                        "bg-field text-ink focus:ring-primary w-full min-w-0 rounded-md border border-transparent px-2.5 py-1.5 font-mono text-sm focus:ring-2 focus:outline-none",
                        isInvalid && "ring-danger ring-1",
                      )}
                    />
                  </div>
                  {isInvalid && (
                    <p id={errorId} className="text-danger text-xs">
                      Use a colour code like #1d4ed8.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          {hasDarkLook && (
            <label className="text-ink-secondary flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!isSplit}
                onChange={(event) => changeSplit(!event.target.checked)}
                className="accent-primary h-4 w-4"
              />
              Use one colour for both looks
            </label>
          )}
        </div>
      )}
    />
  );
};

export default ColorSettingField;
