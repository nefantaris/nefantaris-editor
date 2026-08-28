import { useState } from "react";
import { CheckIcon } from "../../components/Icons.tsx";
import ModalDialog from "../../components/ModalDialog.tsx";
import { classNames } from "../../utils/classNames.ts";
import GoLiveStep from "./GoLiveStep.tsx";
import NamePlaceStep from "./NamePlaceStep.tsx";
import PutOnlineStep from "./PutOnlineStep.tsx";

export type CreatedSite = {
  sitePath: string;
  siteName: string;
  folderName: string;
};

export const wizardPrimaryButtonClasses =
  "bg-brand-primary text-brand-white hover:bg-brand-primaryHover disabled:bg-brand-grayLight disabled:text-brand-disabled grow justify-center rounded-md py-3 font-medium transition-colors duration-100 sm:order-2 sm:w-0";
export const wizardSecondaryButtonClasses =
  "bg-brand-grayLight text-brand-grayDark hover:bg-brand-border grow justify-center rounded-md py-3 font-medium transition-colors duration-100 sm:w-0";

type CreateSiteWizardProps = {
  onClose: () => void;
};

type WizardStage =
  | { kind: "name" }
  | { kind: "online"; site: CreatedSite }
  | { kind: "goLive"; site: CreatedSite; repoName: string }
  | { kind: "done"; site: CreatedSite; summary: string };

const stepLabels = ["Name it", "Put it online", "Go live"];

const LOCAL_ONLY_SUMMARY =
  "Your site is ready on this computer. Everything you write is saved right here.";
const ONLINE_ONLY_SUMMARY =
  "Your site is ready and your first version is saved online. You can finish going live on Cloudflare whenever you like.";

const CreateSiteWizard = ({ onClose }: CreateSiteWizardProps) => {
  const [stage, setStage] = useState<WizardStage>({ kind: "name" });
  const [isBusy, setIsBusy] = useState(false);

  const currentStepIndex =
    stage.kind === "name"
      ? 0
      : stage.kind === "online"
        ? 1
        : stage.kind === "goLive"
          ? 2
          : 3;

  const openCreatedSite = (site: CreatedSite) => {
    void globalThis.nefantaris.invoke("sites:open", site.sitePath);
  };

  return (
    <ModalDialog
      title="Create your site"
      onClose={onClose}
      canDismiss={!isBusy}
    >
      <ol
        aria-label="Setup steps"
        className="flex flex-wrap items-center gap-2 text-xs font-medium"
      >
        {stepLabels.map((label, index) => (
          <li
            key={label}
            aria-current={index === currentStepIndex ? "step" : undefined}
            className="flex items-center gap-1.5"
          >
            <span
              className={classNames(
                "flex size-5 items-center justify-center rounded-full",
                index < currentStepIndex
                  ? "bg-brand-success text-brand-white"
                  : index === currentStepIndex
                    ? "bg-brand-primary text-brand-white"
                    : "bg-brand-grayLight text-brand-gray",
              )}
            >
              {index < currentStepIndex ? <CheckIcon /> : index + 1}
            </span>
            <span
              className={
                index === currentStepIndex
                  ? "text-brand-black"
                  : "text-brand-gray"
              }
            >
              {label}
            </span>
            {index < stepLabels.length - 1 && (
              <span aria-hidden="true" className="bg-brand-border h-px w-3" />
            )}
          </li>
        ))}
      </ol>
      {stage.kind === "name" && (
        <NamePlaceStep
          onBusyChanged={setIsBusy}
          onCancelRequested={onClose}
          onCreated={(site) => setStage({ kind: "online", site })}
        />
      )}
      {stage.kind === "online" && (
        <PutOnlineStep
          site={stage.site}
          onBusyChanged={setIsBusy}
          onPublished={(repoName) =>
            setStage({ kind: "goLive", site: stage.site, repoName })
          }
          onSkipped={() =>
            setStage({
              kind: "done",
              site: stage.site,
              summary: LOCAL_ONLY_SUMMARY,
            })
          }
        />
      )}
      {stage.kind === "goLive" && (
        <GoLiveStep
          repoName={stage.repoName}
          onDeferred={() =>
            setStage({
              kind: "done",
              site: stage.site,
              summary: ONLINE_ONLY_SUMMARY,
            })
          }
          onOpenSiteRequested={() => openCreatedSite(stage.site)}
        />
      )}
      {stage.kind === "done" && (
        <>
          <p className="text-brand-grayDark">{stage.summary}</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => openCreatedSite(stage.site)}
              className={wizardPrimaryButtonClasses}
            >
              Open my site
            </button>
            <button onClick={onClose} className={wizardSecondaryButtonClasses}>
              Close
            </button>
          </div>
        </>
      )}
    </ModalDialog>
  );
};

export default CreateSiteWizard;
