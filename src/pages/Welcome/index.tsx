import { useEffect, useState } from "react";
import type {
  OpenSiteResult,
  RecentSite,
  SiteValidationFailure,
} from "../../../electron/ipcContract.cts";
import SignInModal from "../../components/SignInModal.tsx";
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
    <div className="bg-brand-background flex h-screen flex-col gap-6 p-6">
      <main className="flex min-h-0 grow flex-col gap-6">
        <header>
          <h1 className="text-brand-black text-2xl font-bold">Nefantaris</h1>
          <p className="text-brand-gray">Your site, ready to edit.</p>
        </header>
        {failure && (
          <div
            role="alert"
            className="border-brand-danger text-brand-danger bg-brand-white flex items-start justify-between gap-3 rounded-md border p-4"
          >
            <p>{failure.message}</p>
            {removableFailurePath && (
              <button
                onClick={() => void removeRecentSite(removableFailurePath)}
                className="hover:text-brand-black shrink-0 rounded-md underline transition-colors duration-100"
              >
                Remove from list
              </button>
            )}
          </div>
        )}
        <div className="flex min-h-0 grow gap-6">
          <section
            aria-labelledby="start-heading"
            className="flex w-60 shrink-0 flex-col gap-3"
          >
            <h2
              id="start-heading"
              className="text-brand-black text-lg font-semibold"
            >
              Start
            </h2>
            <button
              onClick={() => void openFromDialog()}
              className="bg-brand-primary text-brand-white hover:bg-brand-primaryHover rounded-md p-4 text-left font-medium transition-colors duration-100"
            >
              Open site…
            </button>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="bg-brand-primary text-brand-white hover:bg-brand-primaryHover rounded-md p-4 text-left font-medium transition-colors duration-100"
            >
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
              className={
                isSignedIn
                  ? "bg-brand-primary text-brand-white hover:bg-brand-primaryHover rounded-md p-4 text-left font-medium transition-colors duration-100"
                  : "bg-brand-grayLight text-brand-gray rounded-md p-4 text-left font-medium"
              }
            >
              Connect existing site
            </button>
          </section>
          <section
            aria-labelledby="recent-heading"
            className="flex min-w-0 grow flex-col gap-3"
          >
            <h2
              id="recent-heading"
              className="text-brand-black text-lg font-semibold"
            >
              Recent sites
            </h2>
            {recentSites.length === 0 ? (
              <p className="text-brand-gray">
                Sites you open will show up here.
              </p>
            ) : (
              <ul className="flex flex-col gap-1 overflow-y-auto">
                {recentSites.map((site) => (
                  <li key={site.path}>
                    <button
                      onClick={() => void openRecentSite(site)}
                      className="hover:bg-brand-grayLight w-full rounded-md p-3 text-left transition-colors duration-100"
                    >
                      <span className="text-brand-black block font-medium">
                        {site.name}
                      </span>
                      <span className="text-brand-gray block truncate text-sm">
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
  );
};

export default Welcome;
