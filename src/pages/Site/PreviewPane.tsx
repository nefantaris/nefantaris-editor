import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { PreviewStatus } from "../../../electron/ipcContract.cts";
import {
  CloseIcon,
  ExternalLinkIcon,
  PencilIcon,
  PointerIcon,
  ReloadIcon,
} from "../../components/Icons.tsx";
import { classNames } from "../../utils/classNames.ts";
import { bridgeMessage, parseBridgeMessage } from "./previewBridge.ts";
import type { PreviewBridgeHub } from "./previewBridgeHub.ts";

export type PreviewFrame = {
  label: string;
  width: number;
  isExact: boolean;
};

type PreviewPaneProps = {
  status: PreviewStatus;
  route: string;
  openFilePath: string | null;
  isDraftNoteVisible: boolean;
  hub: PreviewBridgeHub;
  isStylePicking: boolean;
  frame: PreviewFrame | null;
  onSourceRequested: (file: string, line: number | null) => void;
  onCloseRequested: () => void;
  onRetryRequested: () => void;
};

type BridgeLocation = { frameKey: string; route: string; file: string | null };

type AvailableSize = { width: number; height: number };

const headerButtonClasses =
  "text-ink-muted hover:text-ink hover:bg-raised disabled:text-ink-disabled disabled:hover:bg-transparent rounded-md p-1 transition-colors duration-100";

const PreviewPane = ({
  status,
  route,
  openFilePath,
  isDraftNoteVisible,
  hub,
  isStylePicking,
  frame,
  onSourceRequested,
  onCloseRequested,
  onRetryRequested,
}: PreviewPaneProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const bridgeState = useSyncExternalStore(hub.subscribeState, hub.getState);
  const [reloadCount, setReloadCount] = useState(0);
  const [location, setLocation] = useState<BridgeLocation | null>(null);
  const [available, setAvailable] = useState<AvailableSize | null>(null);

  const previewUrl =
    status.state === "ready" ? new URL(route, status.url).href : null;
  const previewOrigin = previewUrl === null ? null : new URL(previewUrl).origin;
  const frameKey = `${previewUrl ?? ""}#${reloadCount}`;
  const bridge = location?.frameKey === frameKey ? location : null;
  const isSelecting = bridge !== null && bridgeState.isSelecting;
  const editableFile =
    bridge?.file !== null &&
    bridge?.file !== undefined &&
    bridge.file !== openFilePath
      ? bridge.file
      : null;
  const frameWidth =
    frame === null || available === null
      ? null
      : frame.isExact
        ? frame.width
        : Math.max(available.width, frame.width);
  const scale =
    frameWidth === null || available === null || available.width === 0
      ? 1
      : Math.min(1, available.width / frameWidth);
  const pointLabel = isStylePicking
    ? "Pick something to style"
    : "Point at something to edit it";
  const frameNote =
    frame === null || frameWidth === null
      ? null
      : `${frame.label}, ${Math.round(frameWidth)} px wide${
          scale < 1 ? `, shown at ${Math.round(scale * 100)}%` : ""
        }`;

  const postToPreview = (message: Record<string, unknown>) => {
    if (previewOrigin !== null) {
      iframeRef.current?.contentWindow?.postMessage(message, previewOrigin);
    }
  };

  const changeSelecting = (isActive: boolean) => {
    hub.publish({ type: "select-mode", active: isActive });
    postToPreview(bridgeMessage("select-mode", { active: isActive }));
  };

  const openInBrowser = () => {
    if (previewUrl) {
      void globalThis.nefantaris.invoke("system:openExternal", previewUrl);
    }
  };

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      setAvailable({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    hub.attachSender((message) => {
      if (previewOrigin !== null) {
        iframeRef.current?.contentWindow?.postMessage(message, previewOrigin);
      }
    });
    return () => {
      hub.attachSender(null);
      hub.publish({ type: "detached" });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameKey]);

  useEffect(() => {
    if (previewOrigin === null) {
      return;
    }
    const handleMessage = (event: MessageEvent) => {
      const frameWindow = iframeRef.current?.contentWindow;
      if (
        !frameWindow ||
        event.source !== frameWindow ||
        event.origin !== previewOrigin
      ) {
        return;
      }
      const message = parseBridgeMessage(event.data);
      if (message === null) {
        return;
      }
      if (
        message.type === "ready" ||
        message.type === "route" ||
        message.type === "selected"
      ) {
        setLocation({ frameKey, route: message.route, file: message.file });
      }
      hub.publish(message);
      if (
        message.type === "selected" &&
        !isStylePicking &&
        message.file !== null
      ) {
        hub.publish({ type: "select-mode", active: false });
        frameWindow.postMessage(
          bridgeMessage("select-mode", { active: false }),
          previewOrigin,
        );
        onSourceRequested(message.file, message.line);
      }
    };
    globalThis.addEventListener("message", handleMessage);
    return () => globalThis.removeEventListener("message", handleMessage);
  }, [frameKey, previewOrigin, isStylePicking, hub, onSourceRequested]);

  return (
    <section
      aria-label="Site preview"
      className="bg-surface flex h-full min-h-0 flex-col"
    >
      <div className="border-line bg-sunken text-ink-secondary flex h-10 shrink-0 items-center gap-3 border-b px-4 text-sm">
        <span className="text-ink-muted max-w-48 shrink-0 truncate font-mono text-xs">
          {bridge?.route ?? route}
        </span>
        {isDraftNoteVisible && (
          <span className="text-ink-muted min-w-0 truncate text-xs">
            Drafts don&rsquo;t appear in the preview
          </span>
        )}
        {frameNote !== null && (
          <span className="text-ink-muted truncate text-xs tabular-nums">
            {frameNote}
          </span>
        )}
        {isSelecting && (
          <span
            aria-live="polite"
            className="text-ink-secondary min-w-0 truncate text-xs"
          >
            Click something in the preview. Esc stops.
          </span>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {editableFile !== null && (
            <button
              onClick={() => onSourceRequested(editableFile, null)}
              className="text-ink-secondary hover:text-ink hover:bg-raised flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium whitespace-nowrap transition-colors duration-100"
            >
              <PencilIcon />
              Edit this page
            </button>
          )}
          <button
            aria-label={pointLabel}
            title={pointLabel}
            aria-pressed={isSelecting}
            disabled={bridge === null}
            onClick={() => changeSelecting(!isSelecting)}
            className={classNames(
              headerButtonClasses,
              isSelecting && "bg-raised text-ink",
            )}
          >
            <PointerIcon />
          </button>
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
      <div
        ref={viewportRef}
        className={classNames(
          "min-h-0 grow overflow-hidden",
          frameWidth !== null && "bg-raised",
        )}
      >
        {previewUrl !== null && (
          <div
            className="mx-auto h-full"
            style={{
              width: frameWidth === null ? "100%" : frameWidth * scale,
            }}
          >
            <iframe
              ref={iframeRef}
              key={frameKey}
              src={previewUrl}
              title="Site preview"
              onLoad={() => postToPreview(bridgeMessage("ping"))}
              className="bg-surface block h-full w-full origin-top-left"
              style={
                frameWidth === null
                  ? undefined
                  : {
                      width: frameWidth,
                      height: `${100 / scale}%`,
                      transform: `scale(${scale})`,
                    }
              }
            />
          </div>
        )}
        {(status.state === "starting" || status.state === "stopped") && (
          <div className="flex h-full items-center justify-center p-4">
            <p className="text-ink-muted">Starting preview…</p>
          </div>
        )}
        {status.state === "error" && (
          <div className="flex h-full flex-col items-center justify-center gap-3 overflow-y-auto p-6">
            <p className="text-ink-secondary">
              The preview couldn&rsquo;t start.
            </p>
            <p className="text-ink-muted text-center text-sm">
              {status.message}
            </p>
            {status.logTail !== "" && (
              <pre className="bg-sunken border-line text-ink-secondary max-h-64 w-full overflow-auto rounded-md border p-4 font-mono text-xs whitespace-pre-wrap">
                {status.logTail}
              </pre>
            )}
            <button
              onClick={onRetryRequested}
              className="bg-primary text-on-primary hover:bg-primary-hover rounded-md px-4 py-2 font-medium transition-colors duration-100"
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
