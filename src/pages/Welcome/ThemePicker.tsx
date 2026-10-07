import { useId } from "react";
import type { FirstPartyThemeName } from "../../../electron/ipcContract.cts";
import { classNames } from "../../utils/classNames.ts";
import { wizardInputClasses } from "./CreateSiteWizard.tsx";

export type ThemeKey = FirstPartyThemeName | "custom";

type ThemeOption = {
  key: ThemeKey;
  label: string;
  hint: string;
};

const themeOptions: ThemeOption[] = [
  {
    key: "nefantaris-theme-base",
    label: "Base",
    hint: "Pages and a blog. A good place to start.",
  },
  {
    key: "nefantaris-theme-resume",
    label: "Résumé",
    hint: "A one-page résumé.",
  },
  {
    key: "nefantaris-theme-docs",
    label: "Docs",
    hint: "Documentation with a sidebar.",
  },
  {
    key: "custom",
    label: "Another theme",
    hint: "One someone shared with you, from its web address.",
  },
];

type ThemePickerProps = {
  selectedKey: ThemeKey;
  customUrl: string;
  isDisabled: boolean;
  onKeySelected: (key: ThemeKey) => void;
  onCustomUrlChanged: (url: string) => void;
};

const ThemePicker = ({
  selectedKey,
  customUrl,
  isDisabled,
  onKeySelected,
  onCustomUrlChanged,
}: ThemePickerProps) => {
  const groupId = useId();
  const customUrlFieldId = useId();

  return (
    <fieldset disabled={isDisabled} className="flex flex-col gap-2">
      <legend className="text-brand-grayDark mb-1 text-xs font-medium">
        Theme
      </legend>
      {themeOptions.map((option) => (
        <label
          key={option.key}
          className={classNames(
            "flex cursor-pointer items-start gap-3 rounded-md p-3 transition-colors duration-100",
            option.key === selectedKey
              ? "bg-brand-grayLight"
              : "bg-brand-background hover:bg-brand-grayLight",
          )}
        >
          <input
            type="radio"
            name={groupId}
            value={option.key}
            checked={option.key === selectedKey}
            onChange={() => onKeySelected(option.key)}
            aria-labelledby={`${groupId}-${option.key}-label`}
            aria-describedby={`${groupId}-${option.key}-hint`}
            className="accent-brand-primary mt-1 h-4 w-4 shrink-0"
          />
          <span className="flex flex-col">
            <span
              id={`${groupId}-${option.key}-label`}
              className="text-brand-black font-medium"
            >
              {option.label}
            </span>
            <span
              id={`${groupId}-${option.key}-hint`}
              className="text-brand-gray text-sm"
            >
              {option.hint}
            </span>
          </span>
        </label>
      ))}
      {selectedKey === "custom" && (
        <div className="flex flex-col gap-1">
          <label
            htmlFor={customUrlFieldId}
            className="text-brand-grayDark text-xs font-medium"
          >
            Theme address
          </label>
          <input
            id={customUrlFieldId}
            type="url"
            value={customUrl}
            onChange={(event) => onCustomUrlChanged(event.target.value)}
            placeholder="https://github.com/you/your-theme"
            className={wizardInputClasses}
          />
        </div>
      )}
    </fieldset>
  );
};

export default ThemePicker;
