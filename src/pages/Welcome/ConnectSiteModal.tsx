import { useEffect, useState } from "react";
import type {
  ConnectProgress,
  GithubRepo,
} from "../../../electron/ipcContract.cts";
import ModalDialog from "../../components/ModalDialog.tsx";
import { relativeTimeFrom } from "../../utils/relativeTime.ts";

type ConnectSiteModalProps = {
  onClose: () => void;
};

type ConnectPhase =
  | { kind: "loading-repos" }
  | { kind: "repos-failed"; message: string }
  | { kind: "picking"; error: string | null }
  | { kind: "connecting"; repoFullName: string }
  | { kind: "invalid"; path: string };

const primaryButtonClasses =
  "bg-brand-primary text-brand-white hover:bg-brand-primaryHover grow justify-center rounded-md py-3 font-medium transition-colors duration-100 sm:order-2 sm:w-0";
const secondaryButtonClasses =
  "bg-brand-grayLight text-brand-grayDark hover:bg-brand-border grow justify-center rounded-md py-3 font-medium transition-colors duration-100 sm:w-0";

function connectFailureMessage(
  status: "auth-needed" | "offline" | "failed",
): string {
  switch (status) {
    case "auth-needed":
      return "Your sign-in stopped working. Sign out, sign back in, and try again.";
    case "offline":
      return "You're offline. Try again when you're back online.";
    case "failed":
      return "Something went wrong while connecting your site. Try again.";
  }
}

const ConnectSiteModal = ({ onClose }: ConnectSiteModalProps) => {
  const [phase, setPhase] = useState<ConnectPhase>({ kind: "loading-repos" });
  const [repos, setRepos] = useState<GithubRepo[]>([]);
  const [filter, setFilter] = useState("");
  const [progress, setProgress] = useState<ConnectProgress | null>(null);

  const filteredRepos = repos.filter((repo) =>
    repo.fullName.toLowerCase().includes(filter.trim().toLowerCase()),
  );

  const connectRepo = async (repo: GithubRepo) => {
    setProgress(null);
    setPhase({ kind: "connecting", repoFullName: repo.fullName });
    const result = await globalThis.nefantaris.invoke(
      "sites:connect",
      repo.cloneUrl,
      repo.fullName,
    );
    switch (result.status) {
      case "connected":
        onClose();
        return;
      case "cancelled":
        setPhase({ kind: "picking", error: null });
        return;
      case "folder-exists":
        setPhase({
          kind: "picking",
          error: `There's already a folder at ${result.path}. Move it aside or pick a different place.`,
        });
        return;
      case "invalid":
        setPhase({ kind: "invalid", path: result.path });
        return;
      default:
        setPhase({
          kind: "picking",
          error: connectFailureMessage(result.status),
        });
    }
  };

  const removeDownloadedFolder = async (folderPath: string) => {
    await globalThis.nefantaris.invoke("sites:discardClone", folderPath);
    setPhase({ kind: "picking", error: null });
  };

  useEffect(() => {
    const loadRepos = async () => {
      const result = await globalThis.nefantaris.invoke("repos:list");
      if (result.status === "ok") {
        setRepos(result.repos);
        setPhase({ kind: "picking", error: null });
      } else if (result.status === "auth-needed") {
        setPhase({
          kind: "repos-failed",
          message:
            "Your sign-in stopped working. Sign out, sign back in, and try again.",
        });
      } else {
        setPhase({
          kind: "repos-failed",
          message: "Couldn't load your sites from GitHub. Try again later.",
        });
      }
    };
    void loadRepos();
  }, []);

  useEffect(() => {
    return globalThis.nefantaris.on("connect:progress", setProgress);
  }, []);

  return (
    <ModalDialog title="Connect existing site" onClose={onClose}>
      {phase.kind === "loading-repos" && (
        <p className="text-brand-gray">Looking up your sites on GitHub…</p>
      )}
      {phase.kind === "repos-failed" && (
        <>
          <p className="text-brand-grayDark">{phase.message}</p>
          <button onClick={onClose} className={secondaryButtonClasses}>
            Close
          </button>
        </>
      )}
      {phase.kind === "picking" && (
        <>
          <p className="text-brand-grayDark text-sm">
            Pick the site you want to work on from your GitHub account.
          </p>
          {phase.error && (
            <p role="alert" className="text-brand-danger text-sm">
              {phase.error}
            </p>
          )}
          <input
            type="text"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Type to filter…"
            aria-label="Filter your sites"
            className="bg-brand-background text-brand-black placeholder:text-brand-gray focus:ring-brand-primary rounded-md p-3 focus:ring-2 focus:outline-none"
          />
          {filteredRepos.length === 0 ? (
            <p className="text-brand-gray text-sm">
              {repos.length === 0
                ? "There's nothing in your GitHub account yet."
                : "Nothing matches that filter."}
            </p>
          ) : (
            <ul
              aria-label="Your sites on GitHub"
              className="flex max-h-64 flex-col gap-1 overflow-y-auto"
            >
              {filteredRepos.map((repo) => (
                <li key={repo.fullName}>
                  <button
                    onClick={() => void connectRepo(repo)}
                    className="hover:bg-brand-grayLight flex w-full items-baseline justify-between gap-3 rounded-md p-3 text-left transition-colors duration-100"
                  >
                    <span className="text-brand-black min-w-0 truncate font-medium">
                      {repo.fullName}
                    </span>
                    <span className="text-brand-gray shrink-0 text-sm">
                      {repo.pushedAtMs === 0
                        ? ""
                        : relativeTimeFrom(repo.pushedAtMs)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {phase.kind === "connecting" && (
        <>
          <p className="text-brand-grayDark">Connecting your site…</p>
          <progress
            aria-label="Download progress"
            className="w-full"
            {...(progress !== null && progress.total !== null
              ? { value: progress.loaded, max: progress.total }
              : {})}
          />
          <p className="text-brand-gray text-sm">
            Bringing {phase.repoFullName} to this computer.
          </p>
        </>
      )}
      {phase.kind === "invalid" && (
        <>
          <p className="text-brand-grayDark">
            This doesn&rsquo;t look like a Nefantaris site.
          </p>
          <p className="text-brand-gray text-sm">
            The files were downloaded to {phase.path}, but there&rsquo;s no
            Nefantaris site in them.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => void removeDownloadedFolder(phase.path)}
              className={primaryButtonClasses}
            >
              Remove the folder
            </button>
            <button
              onClick={() => setPhase({ kind: "picking", error: null })}
              className={secondaryButtonClasses}
            >
              Keep the folder
            </button>
          </div>
        </>
      )}
    </ModalDialog>
  );
};

export default ConnectSiteModal;
