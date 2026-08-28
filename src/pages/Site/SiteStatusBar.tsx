import type { GitSyncSnapshot } from "../../../electron/ipcContract.cts";
import { PanelRightIcon } from "../../components/Icons.tsx";
import { classNames } from "../../utils/classNames.ts";

type SiteStatusBarProps = {
  siteName: string;
  isFileOpen: boolean;
  isDirty: boolean;
  syncSnapshot: GitSyncSnapshot | null;
  isPreviewOpen: boolean;
  isSignInOffered: boolean;
  onTogglePreview: () => void;
  onPublishRequested: () => void;
  onVersionsRequested: () => void;
  onSignInRequested: () => void;
};

function syncLabelFor(snapshot: GitSyncSnapshot): string {
  if (snapshot.activity === "publishing") {
    return "Publishing…";
  }
  if (snapshot.activity === "updating") {
    return "Updating…";
  }
  if (snapshot.connection === "not-connected") {
    return "Not connected";
  }
  if (snapshot.connection === "offline") {
    return "Offline";
  }
  if (snapshot.isRemoteAhead) {
    return "Newer version online";
  }
  return "Up to date";
}

const SiteStatusBar = ({
  siteName,
  isFileOpen,
  isDirty,
  syncSnapshot,
  isPreviewOpen,
  isSignInOffered,
  onTogglePreview,
  onPublishRequested,
  onVersionsRequested,
  onSignInRequested,
}: SiteStatusBarProps) => {
  const isConnected =
    syncSnapshot !== null && syncSnapshot.connection !== "not-connected";
  const hasSomethingToPublish =
    syncSnapshot !== null &&
    (syncSnapshot.hasLocalEdits ||
      syncSnapshot.isLocalAhead ||
      syncSnapshot.isRemoteAhead);
  const canPublish =
    syncSnapshot !== null &&
    syncSnapshot.activity === "idle" &&
    !syncSnapshot.hasOpenConflicts &&
    hasSomethingToPublish;

  return (
    <footer
      aria-label="Status bar"
      className="border-brand-border bg-brand-background text-brand-grayDark flex items-center justify-between border-t px-4 py-2 text-sm"
    >
      <span data-testid="site-name">{siteName}</span>
      <div className="flex items-center gap-3">
        {isFileOpen && (
          <span className="text-brand-gray">
            {isDirty ? "Saving…" : "Saved"}
          </span>
        )}
        {syncSnapshot && (
          <span className="text-brand-gray" data-testid="sync-status">
            {syncLabelFor(syncSnapshot)}
          </span>
        )}
        {isSignInOffered && (
          <button
            onClick={onSignInRequested}
            className="bg-brand-primary text-brand-white hover:bg-brand-primaryHover rounded-md px-3 py-1 font-medium transition-colors duration-100"
          >
            Sign in
          </button>
        )}
        <button
          onClick={onVersionsRequested}
          className="text-brand-gray hover:text-brand-black hover:bg-brand-grayLight rounded-md px-2 py-1 transition-colors duration-100"
        >
          Versions
        </button>
        {isConnected && (
          <button
            onClick={onPublishRequested}
            disabled={!canPublish}
            title={canPublish ? "Publish your site" : "Everything is live"}
            className={classNames(
              "rounded-md px-3 py-1 font-medium transition-colors duration-100",
              canPublish
                ? "bg-brand-primary text-brand-white hover:bg-brand-primaryHover"
                : "bg-brand-grayLight text-brand-disabled",
            )}
          >
            Publish
          </button>
        )}
        <button
          aria-label="Preview"
          aria-pressed={isPreviewOpen}
          onClick={onTogglePreview}
          title="Preview (⌘E)"
          className={classNames(
            "rounded-md p-1 transition-colors duration-100",
            isPreviewOpen
              ? "text-brand-primary hover:text-brand-primaryHover"
              : "text-brand-gray hover:text-brand-black hover:bg-brand-grayLight",
          )}
        >
          <PanelRightIcon />
        </button>
      </div>
    </footer>
  );
};

export default SiteStatusBar;
