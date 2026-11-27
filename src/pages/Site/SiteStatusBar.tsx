import type { GitSyncSnapshot } from "../../../electron/ipcContract.cts";
import { PanelRightIcon } from "../../components/Icons.tsx";
import StatusDot, { type StatusTone } from "../../components/StatusDot.tsx";
import { classNames } from "../../utils/classNames.ts";

export type SaveState = "saving" | "saved" | "notSaved";

const saveStateLabels: Record<SaveState, string> = {
  saving: "Saving…",
  saved: "Saved",
  notSaved: "Not saved yet",
};

type SiteStatusBarProps = {
  siteName: string;
  saveState: SaveState | null;
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

function syncToneFor(snapshot: GitSyncSnapshot): StatusTone {
  if (snapshot.activity !== "idle") {
    return "progress";
  }
  if (
    snapshot.connection === "not-connected" ||
    snapshot.connection === "offline"
  ) {
    return "quiet";
  }
  if (snapshot.isRemoteAhead) {
    return "attention";
  }
  return "positive";
}

const SiteStatusBar = ({
  siteName,
  saveState,
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
      className="border-line bg-sunken text-ink-secondary flex h-10 shrink-0 items-center justify-between gap-3 border-t px-4 text-sm"
    >
      <span data-testid="site-name" className="text-ink truncate font-medium">
        {siteName}
      </span>
      <div className="flex shrink-0 items-center gap-2">
        {saveState !== null && (
          <span className="text-ink-muted px-2">
            {saveStateLabels[saveState]}
          </span>
        )}
        {syncSnapshot && (
          <span
            className="text-ink-muted flex items-center gap-2 px-2"
            data-testid="sync-status"
          >
            <StatusDot tone={syncToneFor(syncSnapshot)} />
            {syncLabelFor(syncSnapshot)}
          </span>
        )}
        {isSignInOffered && (
          <button
            onClick={onSignInRequested}
            className="bg-primary text-on-primary hover:bg-primary-hover rounded-md px-3 py-1 font-medium transition-colors duration-100"
          >
            Sign in
          </button>
        )}
        <button
          onClick={onVersionsRequested}
          className="text-ink-secondary hover:text-ink hover:bg-raised rounded-md px-2 py-1 transition-colors duration-100"
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
                ? "bg-primary text-on-primary hover:bg-primary-hover"
                : "bg-raised text-ink-disabled",
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
            "rounded-md p-1.5 transition-colors duration-100",
            isPreviewOpen
              ? "bg-raised text-primary-ink"
              : "text-ink-muted hover:text-ink hover:bg-raised",
          )}
        >
          <PanelRightIcon />
        </button>
      </div>
    </footer>
  );
};

export default SiteStatusBar;
