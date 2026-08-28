import { useState } from "react";
import type { PreviewStatus } from "../../../electron/ipcContract.cts";
import {
  CloseIcon,
  ExternalLinkIcon,
  ReloadIcon,
} from "../../components/Icons.tsx";

type PreviewPaneProps = {
  status: PreviewStatus;
  route: string;
  isDraftNoteVisible: boolean;
  onCloseRequested: () => void;
  onRetryRequested: () => void;
};

const headerButtonClasses =
  "text-brand-gray hover:text-brand-black hover:bg-brand-grayLight disabled:text-brand-disabled disabled:hover:bg-transparent rounded-md p-1 transition-colors duration-100";

const PreviewPane = ({
  status,
  route,
  isDraftNoteVisible,
  onCloseRequested,
  onRetryRequested,
}: PreviewPaneProps) => {
  const [reloadCount, setReloadCount] = useState(0);

  const previewUrl =
    status.state === "ready" ? new URL(route, status.url).href : null;

  const openInBrowser = () => {
    if (previewUrl) {
      void globalThis.nefantaris.invoke("system:openExternal", previewUrl);
    }
  };

  return (
    <section
      aria-label="Site preview"
      className="bg-brand-white flex h-full min-h-0 flex-col"
    >
      <div className="border-brand-border bg-brand-background text-brand-grayDark flex shrink-0 items-center gap-3 border-b px-4 py-1.5 text-sm">
        <span className="text-brand-gray truncate">{route}</span>
        {isDraftNoteVisible && (
          <span className="text-brand-gray text-xs italic">
            Drafts don&rsquo;t appear in the preview
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <button
            aria-label="Reload preview"
            disabled={previewUrl === null}
            onClick={() => setReloadCount(reloadCount + 1)}
            className={headerButtonClasses}
          >
            <ReloadIcon />
          </button>
          <button
            aria-label="Open in browser"
            disabled={previewUrl === null}
            onClick={openInBrowser}
            className={headerButtonClasses}
          >
            <ExternalLinkIcon />
          </button>
          <button
            aria-label="Close preview"
            onClick={onCloseRequested}
            className={headerButtonClasses}
          >
            <CloseIcon />
          </button>
        </div>
      </div>
      <div className="min-h-0 grow">
        {previewUrl !== null && (
          <iframe
            key={`${previewUrl}#${reloadCount}`}
            src={previewUrl}
            title="Site preview"
            className="bg-brand-white h-full w-full"
          />
        )}
        {(status.state === "starting" || status.state === "stopped") && (
          <div className="flex h-full items-center justify-center p-4">
            <p className="text-brand-gray">Starting preview…</p>
          </div>
        )}
        {status.state === "error" && (
          <div className="flex h-full flex-col items-center justify-center gap-3 overflow-y-auto p-6">
            <p className="text-brand-grayDark">
              The preview couldn&rsquo;t start.
            </p>
            <p className="text-brand-gray text-center text-sm">
              {status.message}
            </p>
            {status.logTail !== "" && (
              <pre className="bg-brand-background border-brand-border text-brand-grayDark max-h-64 w-full overflow-auto rounded-md border p-4 font-mono text-xs whitespace-pre-wrap">
                {status.logTail}
              </pre>
            )}
            <button
              onClick={onRetryRequested}
              className="bg-brand-primary text-brand-white hover:bg-brand-primaryHover rounded-md px-4 py-2 transition-colors duration-100"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

export default PreviewPane;
