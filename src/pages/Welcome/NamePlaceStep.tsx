import { useId, useState } from "react";
import type {
  NewSitePlan,
  ThemeChoice,
} from "../../../electron/ipcContract.cts";
import type { CreatedSite } from "./CreateSiteWizard.tsx";
import {
  wizardInputClasses,
  wizardPrimaryButtonClasses,
  wizardSecondaryButtonClasses,
} from "./CreateSiteWizard.tsx";
import type { ThemeKey } from "./ThemePicker.tsx";
import ThemePicker from "./ThemePicker.tsx";

type NamePlaceStepProps = {
  onBusyChanged: (isBusy: boolean) => void;
  onCancelRequested: () => void;
  onCreated: (site: CreatedSite) => void;
};

const NamePlaceStep = ({
  onBusyChanged,
  onCancelRequested,
  onCreated,
}: NamePlaceStepProps) => {
  const nameFieldId = useId();
  const [siteName, setSiteName] = useState("");
  const [parentFolder, setParentFolder] = useState<string | null>(null);
  const [plan, setPlan] = useState<NewSitePlan | null>(null);
  const [themeKey, setThemeKey] = useState<ThemeKey>("nefantaris-theme-base");
  const [customThemeUrl, setCustomThemeUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const theme: ThemeChoice =
    themeKey === "custom"
      ? { kind: "gitUrl", url: customThemeUrl.trim() }
      : { kind: "firstParty", name: themeKey };
  const canCreate =
    !isCreating &&
    siteName.trim() !== "" &&
    plan !== null &&
    plan.targetPath !== null &&
    !plan.isTaken &&
    (theme.kind === "firstParty" || theme.url !== "");

  const refreshPlan = async (nextParent: string | null, nextName: string) => {
    if (nextParent === null || nextName.trim() === "") {
      setPlan(null);
      return;
    }
    setPlan(
      await globalThis.nefantaris.invoke(
        "sites:planCreate",
        nextParent,
        nextName.trim(),
      ),
    );
  };

  const changeSiteName = (value: string) => {
    setSiteName(value);
    void refreshPlan(parentFolder, value);
  };

  const chooseParentFolder = async () => {
    const picked = await globalThis.nefantaris.invoke("sites:pickCreateParent");
    if (picked === null) {
      return;
    }
    setParentFolder(picked);
    await refreshPlan(picked, siteName);
  };

  const createSite = async () => {
    if (parentFolder === null) {
      return;
    }
    setError(null);
    setIsCreating(true);
    onBusyChanged(true);
    const result = await globalThis.nefantaris.invoke(
      "sites:create",
      parentFolder,
      siteName.trim(),
      theme,
    );
    setIsCreating(false);
    onBusyChanged(false);
    if (result.status === "created") {
      onCreated({
        sitePath: result.sitePath,
        siteName: result.siteName,
        folderName: result.folderName,
      });
      return;
    }
    if (result.status === "folder-exists") {
      await refreshPlan(parentFolder, siteName);
      setError(
        `There's already a folder at ${result.path}. Pick a different name or place.`,
      );
      return;
    }
    setError(result.message);
  };

  return (
    <>
      <p className="text-brand-grayDark text-sm">
        Pick a name, a place on this computer, and a theme. You can put it
        online in the next step. Creating a site downloads its theme, so
        you&rsquo;ll need to be online.
      </p>
      {error && (
        <p role="alert" className="text-brand-danger text-sm">
          {error}
        </p>
      )}
      <div className="flex flex-col gap-1">
        <label
          htmlFor={nameFieldId}
          className="text-brand-grayDark text-xs font-medium"
        >
          Site name
        </label>
        <input
          id={nameFieldId}
          type="text"
          value={siteName}
          disabled={isCreating}
          onChange={(event) => changeSiteName(event.target.value)}
          placeholder="My Garden Journal"
          className={wizardInputClasses}
        />
      </div>
      <div className="flex flex-col gap-1">
        <button
          onClick={() => void chooseParentFolder()}
          disabled={isCreating}
          className="bg-brand-grayLight text-brand-grayDark hover:bg-brand-border self-start rounded-md px-4 py-2 text-sm font-medium transition-colors duration-100"
        >
          {parentFolder === null
            ? "Choose where to keep it"
            : "Choose a different place"}
        </button>
        {plan !== null && plan.targetPath !== null && !plan.isTaken && (
          <p className="text-brand-gray text-sm break-all">
            Your site will be saved at {plan.targetPath}
          </p>
        )}
        {plan !== null && plan.isTaken && (
          <p role="alert" className="text-brand-danger text-sm break-all">
            There&rsquo;s already a folder named &ldquo;{plan.folderName}&rdquo;
            there. Pick a different name or place.
          </p>
        )}
      </div>
      <ThemePicker
        selectedKey={themeKey}
        customUrl={customThemeUrl}
        isDisabled={isCreating}
        onKeySelected={setThemeKey}
        onCustomUrlChanged={setCustomThemeUrl}
      />
      {isCreating && (
        <p aria-live="polite" className="text-brand-gray text-sm">
          Creating your site and downloading its theme…
        </p>
      )}
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          onClick={() => void createSite()}
          disabled={!canCreate}
          className={wizardPrimaryButtonClasses}
        >
          {isCreating ? "Creating…" : "Create my site"}
        </button>
        <button
          onClick={onCancelRequested}
          disabled={isCreating}
          className={wizardSecondaryButtonClasses}
        >
          Cancel
        </button>
      </div>
    </>
  );
};

export default NamePlaceStep;
