import { useEffect, useState } from "react";
import type {
  OpenSiteResult,
  RecentSite,
  SiteValidationFailure,
} from "../../../electron/ipcContract.cts";
import {
  CloudDownloadIcon,
  FolderIcon,
  PlusIcon,
  SpiderwebMark,
} from "../../components/Icons.tsx";
import SignInModal from "../../components/SignInModal.tsx";
import { classNames } from "../../utils/classNames.ts";
import { useAuthStatus } from "../../utils/useAuthStatus.ts";
import AccountArea from "./AccountArea.tsx";
import ConnectSiteModal from "./ConnectSiteModal.tsx";
import CreateSiteWizard from "./CreateSiteWizard.tsx";

type OpenFailure = {
  message: string;
  removablePath: string | null;
};

const describeFailure = (
  path: string,
  reason: SiteValidationFailure,
): string => {
  switch (reason) {
    case "folder-missing":
      return `The folder ${path} no longer exists.`;
    case "config-missing":
      return `${path} has no nefantaris.json, so it isn't a Nefantaris site.`;
    case "config-unparseable":
      return `The nefantaris.json in ${path} isn't valid JSON.`;
    case "name-missing":
      return `The nefantaris.json in ${path} is missing a site name.`;
  }
};

const startActionClasses =
  "bg-raised text-ink hover:bg-raised-strong flex items-center gap-3 rounded-md px-4 py-3 text-left text-sm font-medium transition-colors duration-100";

const Welcome = () => {
  const authStatus = useAuthStatus();
  const [recentSites, setRecentSites] = useState<RecentSite[]>([]);
  const [failure, setFailure] = useState<OpenFailure | null>(null);
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const removableFailurePath = failure?.removablePath ?? null;
  const isSignedIn = authStatus?.state === "signed-in";

  const applyOpenResult = (
    result: OpenSiteResult,
    removablePath: string | null,
  ) => {
    if (result.status === "invalid") {
      setFailure({
        message: describeFailure(result.path, result.reason),
        removablePath,
      });
    }
  };

  const openFromDialog = async () => {
    setFailure(null);
    applyOpenResult(
      await globalThis.nefantaris.invoke("sites:openFromDialog"),
      null,
    );
  };

  const openRecentSite = async (site: RecentSite) => {
    setFailure(null);
    applyOpenResult(
      await globalThis.nefantaris.invoke("sites:open", site.path),
      site.path,
    );
  };

  const removeRecentSite = async (sitePath: string) => {
    setRecentSites(
      await globalThis.nefantaris.invoke("recentSites:remove", sitePath),
    );
    setFailure(null);
  };

  useEffect(() => {
    const loadRecentSites = async () => {
      setRecentSites(await globalThis.nefantaris.invoke("recentSites:list"));
    };
    void loadRecentSites();
    return globalThis.nefantaris.on("recentSites:changed", setRecentSites);
  }, []);

  return (
    <div className="bg-sunken h-screen overflow-y-auto">
      <div className="mx-auto flex h-full min-h-128 max-w-4xl flex-col gap-6 p-6">
        <main className="flex min-h-0 grow flex-col gap-6">
          <header className="flex items-center gap-3">
            <SpiderwebMark className="size-10 shrink-0" />
            <div className="flex flex-col">
              <h1 className="text-ink text-2xl leading-tight font-semibold">
                Nefantaris
              </h1>
              <p className="text-ink-muted text-sm">Your site, ready to edit</p>
            </div>
          </header>
          {failure && (
            <div
              role="alert"
              className="bg-surface text-ink flex items-start justify-between gap-3 rounded-md p-4 text-sm"
            >
              <p className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="bg-danger mt-1.5 size-2 shrink-0 rounded-full"
                />
                <span>{failure.message}</span>
              </p>
              {removableFailurePath && (
                <button
                  onClick={() => void removeRecentSite(removableFailurePath)}
                  className="bg-raised text-ink hover:bg-raised-strong shrink-0 rounded-md px-3 py-1.5 font-medium transition-colors duration-100"
                >
                  Remove from list
                </button>
              )}
            </div>
          )}
          <div className="flex min-h-0 grow gap-6">
            <section
              aria-labelledby="start-heading"
              className="flex w-56 shrink-0 flex-col gap-3"
            >
              <h2
                id="start-heading"
                className="text-ink-secondary text-sm font-medium"
              >
                Start
              </h2>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => void openFromDialog()}
                  className={startActionClasses}
                >
                  <FolderIcon className="text-ink-muted shrink-0" />
                  Open site…
                </button>
                <button
                  onClick={() => setIsCreateOpen(true)}
                  className="bg-primary text-on-primary hover:bg-primary-hover flex items-center gap-3 rounded-md px-4 py-3 text-left text-sm font-medium transition-colors duration-100"
                >
                  <PlusIcon className="shrink-0" />
                  Create site
                </button>
                <button
                  disabled={!isSignedIn}
                  title={
                    authStatus?.state === "signed-out"
                      ? "Sign in to GitHub first"
                      : undefined
                  }
                  onClick={() => setIsConnectOpen(true)}
                  className={classNames(
                    startActionClasses,
                    "disabled:text-ink-disabled disabled:hover:bg-raised disabled:cursor-default",
                  )}
                >
                  <CloudDownloadIcon className="shrink-0" />
                  Connect existing site
                </button>
              </div>
            </section>
            <section
              aria-labelledby="recent-heading"
              className="flex min-w-0 grow flex-col gap-3"
            >
              <h2
                id="recent-heading"
                className="text-ink-secondary text-sm font-medium"
              >
                Recent sites
              </h2>
              {recentSites.length === 0 ? (
                <p className="bg-surface text-ink-muted rounded-md p-4 text-sm">
                  Sites you open will show up here.
                </p>
              ) : (
                <ul className="bg-surface flex min-h-0 flex-col gap-1 overflow-y-auto rounded-md p-2">
                  {recentSites.map((site) => (
                    <li key={site.path}>
                      <button
                        onClick={() => void openRecentSite(site)}
                        className="hover:bg-raised w-full rounded-md px-3 py-2 text-left transition-colors duration-100"
                      >
                        <span className="text-ink block text-sm font-medium">
                          {site.name}
                        </span>
                        <span className="text-ink-muted block truncate text-xs">
                          {site.path}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </main>
        <AccountArea
          status={authStatus}
          onSignInRequested={() => setIsSignInOpen(true)}
        />
        {isSignInOpen && <SignInModal onClose={() => setIsSignInOpen(false)} />}
        {isConnectOpen && (
          <ConnectSiteModal onClose={() => setIsConnectOpen(false)} />
        )}
        {isCreateOpen && (
          <CreateSiteWizard onClose={() => setIsCreateOpen(false)} />
        )}
      </div>
    </div>
  );
};

export default Welcome;
