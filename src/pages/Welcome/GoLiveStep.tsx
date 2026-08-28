import { useEffect, useId, useRef, useState } from "react";
import {
  wizardPrimaryButtonClasses,
  wizardSecondaryButtonClasses,
} from "./CreateSiteWizard.tsx";

type GoLiveStepProps = {
  repoName: string;
  onDeferred: () => void;
  onOpenSiteRequested: () => void;
};

const BUILD_COMMAND = "npx nef build";
const OUTPUT_DIRECTORY = "dist";
const CLOUDFLARE_DASHBOARD_URL = "https://dash.cloudflare.com/";
const POLL_INTERVAL_MS = 5000;
const MAX_POLL_COUNT = 180;

const CopyField = ({ label, value }: { label: string; value: string }) => {
  const [isCopied, setIsCopied] = useState(false);

  const copyValue = async () => {
    await navigator.clipboard.writeText(value);
    setIsCopied(true);
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-brand-grayDark w-28 shrink-0 text-xs font-medium">
        {label}
      </span>
      <code className="bg-brand-background text-brand-black grow rounded-md px-2 py-1 text-sm">
        {value}
      </code>
      <button
        onClick={() => void copyValue()}
        aria-label={`Copy the ${label.toLowerCase()}`}
        className="text-brand-grayDark hover:bg-brand-grayLight shrink-0 rounded-md px-2 py-1 text-sm font-medium transition-colors duration-100"
      >
        {isCopied ? "Copied" : "Copy"}
      </button>
    </div>
  );
};

const GoLiveStep = ({
  repoName,
  onDeferred,
  onOpenSiteRequested,
}: GoLiveStepProps) => {
  const addressFieldId = useId();
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCountRef = useRef(0);
  const [siteUrl, setSiteUrl] = useState(`https://${repoName}.pages.dev`);
  const [checkState, setCheckState] = useState<"idle" | "checking" | "live">(
    "idle",
  );
  const [hasGivenUp, setHasGivenUp] = useState(false);

  const clearPollTimer = () => {
    if (pollTimerRef.current === null) {
      return;
    }
    clearInterval(pollTimerRef.current);
    pollTimerRef.current = null;
  };

  const stopChecking = () => {
    clearPollTimer();
    setCheckState("idle");
  };

  const probeOnce = async () => {
    const isLive = await globalThis.nefantaris.invoke(
      "liveness:check",
      siteUrl,
    );
    if (isLive) {
      clearPollTimer();
      setCheckState("live");
      return;
    }
    pollCountRef.current += 1;
    if (pollCountRef.current >= MAX_POLL_COUNT) {
      clearPollTimer();
      setCheckState("idle");
      setHasGivenUp(true);
    }
  };

  const startChecking = () => {
    setHasGivenUp(false);
    setCheckState("checking");
    pollCountRef.current = 0;
    void probeOnce();
    pollTimerRef.current = setInterval(
      () => void probeOnce(),
      POLL_INTERVAL_MS,
    );
  };

  const openExternal = (url: string) => {
    void globalThis.nefantaris.invoke("system:openExternal", url);
  };

  useEffect(() => {
    return () => {
      if (pollTimerRef.current !== null) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, []);

  return (
    <>
      <p className="text-brand-grayDark text-sm">
        Cloudflare Pages hosts your site for free. This takes about two minutes
        in your browser:
      </p>
      <ol className="text-brand-grayDark flex list-decimal flex-col gap-1.5 pl-5 text-sm">
        <li>Open dash.cloudflare.com and sign in — a free account works.</li>
        <li>
          Go to Workers &amp; Pages, choose Create application, then the Pages
          tab.
        </li>
        <li>
          Choose Connect to Git and pick{" "}
          <span className="font-medium">{repoName}</span>.
        </li>
        <li>
          Set the framework preset to None and enter the two settings below.
        </li>
        <li>Choose Save and Deploy.</li>
      </ol>
      <div className="flex flex-col gap-2">
        <CopyField label="Build command" value={BUILD_COMMAND} />
        <CopyField label="Output folder" value={OUTPUT_DIRECTORY} />
      </div>
      <div className="border-brand-border flex flex-col gap-2 border-t pt-4">
        <label
          htmlFor={addressFieldId}
          className="text-brand-grayDark text-xs font-medium"
        >
          Your site&rsquo;s address
        </label>
        <div className="flex gap-2">
          <input
            id={addressFieldId}
            type="text"
            value={siteUrl}
            disabled={checkState !== "idle"}
            onChange={(event) => setSiteUrl(event.target.value)}
            className="bg-brand-background text-brand-black focus:ring-brand-primary min-w-0 grow rounded-md p-3 text-sm focus:ring-2 focus:outline-none"
          />
          {checkState === "checking" ? (
            <button
              onClick={stopChecking}
              className="bg-brand-grayLight text-brand-grayDark hover:bg-brand-border shrink-0 rounded-md px-4 py-2 font-medium transition-colors duration-100"
            >
              Stop
            </button>
          ) : (
            <button
              onClick={startChecking}
              disabled={checkState === "live"}
              className="bg-brand-grayLight text-brand-grayDark hover:bg-brand-border disabled:text-brand-disabled shrink-0 rounded-md px-4 py-2 font-medium transition-colors duration-100"
            >
              Check
            </button>
          )}
        </div>
        {checkState === "checking" && (
          <p aria-live="polite" className="text-brand-gray text-sm">
            Checking every few seconds… the first deploy can take a couple of
            minutes.
          </p>
        )}
        {hasGivenUp && (
          <p aria-live="polite" className="text-brand-gray text-sm">
            It&rsquo;s not answering yet. Give Cloudflare a little longer, then
            check again.
          </p>
        )}
        {checkState === "live" && (
          <p
            role="status"
            className="bg-brand-background text-brand-success rounded-md p-3 text-sm font-medium"
          >
            Your site is live.
          </p>
        )}
      </div>
      {checkState === "live" ? (
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            onClick={onOpenSiteRequested}
            className={wizardPrimaryButtonClasses}
          >
            Open my site
          </button>
          <button
            onClick={() => openExternal(siteUrl)}
            className={wizardSecondaryButtonClasses}
          >
            Open your site
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            onClick={() => openExternal(CLOUDFLARE_DASHBOARD_URL)}
            className={wizardPrimaryButtonClasses}
          >
            Open Cloudflare
          </button>
          <button onClick={onDeferred} className={wizardSecondaryButtonClasses}>
            Do this later
          </button>
        </div>
      )}
    </>
  );
};

export default GoLiveStep;
