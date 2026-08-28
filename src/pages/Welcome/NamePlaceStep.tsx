import { useEffect, useId, useState } from "react";
import type { NewSitePlan } from "../../../electron/ipcContract.cts";
import type { CreatedSite } from "./CreateSiteWizard.tsx";
import {
  wizardPrimaryButtonClasses,
  wizardSecondaryButtonClasses,
} from "./CreateSiteWizard.tsx";

type NamePlaceStepProps = {
  onBusyChanged: (isBusy: boolean) => void;
  onCancelRequested: () => void;
  onCreated: (site: CreatedSite) => void;
};

const inputClasses =
  "bg-brand-background text-brand-black placeholder:text-brand-gray focus:ring-brand-primary rounded-md p-3 focus:ring-2 focus:outline-none";

const NamePlaceStep = ({
  onBusyChanged,
  onCancelRequested,
  onCreated,
}: NamePlaceStepProps) => {
  const nameFieldId = useId();
  const themeFieldId = useId();
  const [siteName, setSiteName] = useState("");
  const [parentFolder, setParentFolder] = useState<string | null>(null);
  const [plan, setPlan] = useState<NewSitePlan | null>(null);
  const [themeFolder, setThemeFolder] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const themeValue = themeFolder ?? "";
  const canCreate =
    !isCreating &&
    siteName.trim() !== "" &&
    plan !== null &&
    plan.targetPath !== null &&
    !plan.isTaken &&
    themeValue.trim() !== "";

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
      themeValue.trim(),
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

  useEffect(() => {
    const loadDefaultTheme = async () => {
      const suggested = await globalThis.nefantaris.invoke(
        "sites:defaultThemeFolder",
      );
      if (suggested !== null) {
        setThemeFolder((current) => current ?? suggested);
      }
    };
    void loadDefaultTheme();
  }, []);

  return (
    <>
      <p className="text-brand-grayDark text-sm">
        Pick a name and a place on this computer. You can put it online in the
        next step.
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
          className={inputClasses}
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
      <div className="flex flex-col gap-1">
        <label
          htmlFor={themeFieldId}
          className="text-brand-grayDark text-xs font-medium"
        >
          Theme folder
        </label>
        <input
          id={themeFieldId}
          type="text"
          value={themeValue}
          disabled={isCreating}
          onChange={(event) => setThemeFolder(event.target.value)}
          className={inputClasses}
        />
        <p className="text-brand-gray text-xs">
          The folder on this computer that holds your site&rsquo;s design.
        </p>
      </div>
      {isCreating && (
        <p aria-live="polite" className="text-brand-gray text-sm">
          Creating your site…
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
