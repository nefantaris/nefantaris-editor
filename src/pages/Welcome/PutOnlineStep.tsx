import { useId, useState } from "react";
import SignInModal from "../../components/SignInModal.tsx";
import { useAuthStatus } from "../../utils/useAuthStatus.ts";
import type { CreatedSite } from "./CreateSiteWizard.tsx";
import {
  wizardPrimaryButtonClasses,
  wizardSecondaryButtonClasses,
} from "./CreateSiteWizard.tsx";

type PutOnlineStepProps = {
  site: CreatedSite;
  onBusyChanged: (isBusy: boolean) => void;
  onPublished: (repoName: string) => void;
  onSkipped: () => void;
};

const REPO_NAME_PATTERN = /^[A-Za-z0-9._-]+$/;

const PutOnlineStep = ({
  site,
  onBusyChanged,
  onPublished,
  onSkipped,
}: PutOnlineStepProps) => {
  const repoNameFieldId = useId();
  const authStatus = useAuthStatus();
  const [repoName, setRepoName] = useState(site.folderName);
  const [wiredRepoName, setWiredRepoName] = useState<string | null>(null);
  const [workingLabel, setWorkingLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSignInOpen, setIsSignInOpen] = useState(false);

  const trimmedRepoName = repoName.trim();
  const isRepoNameValid = REPO_NAME_PATTERN.test(trimmedRepoName);
  const isWorking = workingLabel !== null;

  const finishWithError = (message: string) => {
    setError(message);
    setWorkingLabel(null);
    onBusyChanged(false);
  };

  const publishFailureMessage = (
    status: "offline" | "auth-needed" | "failed",
  ): string => {
    switch (status) {
      case "offline":
        return "You're offline. Your site is safe on this computer — try again when you're back online.";
      case "auth-needed":
        return "Your sign-in stopped working. Sign out, sign back in, and try again.";
      case "failed":
        return "Something went wrong while putting your site online. Your site is safe on this computer — try again.";
    }
  };

  const putOnline = async () => {
    setError(null);
    onBusyChanged(true);
    let onlineName = wiredRepoName;
    if (onlineName === null) {
      setWorkingLabel("Creating your site's online home…");
      const created = await globalThis.nefantaris.invoke(
        "repos:create",
        trimmedRepoName,
      );
      if (created.status === "name-taken") {
        finishWithError(
          "That name is already used in your GitHub account. Try a different one.",
        );
        return;
      }
      if (created.status === "auth-needed") {
        finishWithError(
          "Your sign-in stopped working. Sign out, sign back in, and try again.",
        );
        return;
      }
      if (created.status === "failed") {
        finishWithError(
          "Couldn't create your site's online home. Try again in a moment.",
        );
        return;
      }
      await globalThis.nefantaris.invoke(
        "sites:setOnlineRemote",
        site.sitePath,
        created.cloneUrl,
      );
      onlineName = trimmedRepoName;
      setWiredRepoName(onlineName);
    }
    setWorkingLabel("Putting your first version online…");
    const outcome = await globalThis.nefantaris.invoke(
      "publish:run",
      site.sitePath,
      null,
    );
    if (outcome.status === "done" || outcome.status === "nothing-to-publish") {
      setWorkingLabel(null);
      onBusyChanged(false);
      onPublished(onlineName);
      return;
    }
    if (
      outcome.status === "offline" ||
      outcome.status === "auth-needed" ||
      outcome.status === "failed"
    ) {
      finishWithError(publishFailureMessage(outcome.status));
      return;
    }
    finishWithError(publishFailureMessage("failed"));
  };

  return (
    <>
      {authStatus?.state === "unconfigured" && (
        <>
          <p className="text-brand-grayDark text-sm">
            Online publishing isn&rsquo;t set up in this build yet, so your site
            will stay on this computer for now.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={onSkipped}
              className={wizardSecondaryButtonClasses}
            >
              Skip for now
            </button>
          </div>
        </>
      )}
      {authStatus?.state === "signed-out" && (
        <>
          <p className="text-brand-grayDark text-sm">
            Sign in to GitHub to keep an online copy of your site. That&rsquo;s
            what lets you publish it to the web.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => setIsSignInOpen(true)}
              className={wizardPrimaryButtonClasses}
            >
              Sign in to GitHub
            </button>
            <button
              onClick={onSkipped}
              className={wizardSecondaryButtonClasses}
            >
              Skip for now
            </button>
          </div>
        </>
      )}
      {authStatus?.state === "signed-in" && (
        <>
          <p className="text-brand-grayDark text-sm">
            We&rsquo;ll keep an online copy of your site in your GitHub account
            and put your first version there.
          </p>
          {error && (
            <p role="alert" className="text-brand-danger text-sm">
              {error}
            </p>
          )}
          <div className="flex flex-col gap-1">
            <label
              htmlFor={repoNameFieldId}
              className="text-brand-grayDark text-xs font-medium"
            >
              Name for the online copy
            </label>
            <input
              id={repoNameFieldId}
              type="text"
              value={repoName}
              disabled={isWorking || wiredRepoName !== null}
              onChange={(event) => setRepoName(event.target.value)}
              className="bg-brand-background text-brand-black focus:ring-brand-primary rounded-md p-3 focus:ring-2 focus:outline-none"
            />
            <p className="text-brand-gray text-xs">
              Letters, numbers, dashes, dots, and underscores work here.
            </p>
          </div>
          {isWorking && (
            <p aria-live="polite" className="text-brand-gray text-sm">
              {workingLabel}
            </p>
          )}
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => void putOnline()}
              disabled={isWorking || !isRepoNameValid}
              className={wizardPrimaryButtonClasses}
            >
              {isWorking ? "Working…" : "Put it online"}
            </button>
            <button
              onClick={onSkipped}
              disabled={isWorking}
              className={wizardSecondaryButtonClasses}
            >
              Skip for now
            </button>
          </div>
        </>
      )}
      {isSignInOpen && <SignInModal onClose={() => setIsSignInOpen(false)} />}
    </>
  );
};

export default PutOnlineStep;
