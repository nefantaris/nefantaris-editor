import fs from "node:fs";
import path from "node:path";
import { broadcast } from "./typedIpc.cjs";

const BROADCAST_DEBOUNCE_MS = 200;

type SiteWatch = {
  watcher: fs.FSWatcher;
  timer: NodeJS.Timeout | null;
};

const watchesBySitePath = new Map<string, SiteWatch>();

function scheduleBroadcast(sitePath: string): void {
  const watch = watchesBySitePath.get(sitePath);
  if (!watch) {
    return;
  }
  if (watch.timer) {
    clearTimeout(watch.timer);
  }
  watch.timer = setTimeout(() => {
    watch.timer = null;
    broadcast("content:changed", { sitePath });
  }, BROADCAST_DEBOUNCE_MS);
}

export function watchSiteContent(sitePath: string): void {
  if (watchesBySitePath.has(sitePath)) {
    return;
  }
  const watcher = fs.watch(
    sitePath,
    { recursive: true },
    (_eventType, fileName) => {
      if (typeof fileName !== "string") {
        return;
      }
      const normalized = fileName.split(path.sep).join("/");
      if (!normalized.startsWith("content/")) {
        return;
      }
      scheduleBroadcast(sitePath);
    },
  );
  watchesBySitePath.set(sitePath, { watcher, timer: null });
}

export function unwatchSiteContent(sitePath: string): void {
  const watch = watchesBySitePath.get(sitePath);
  if (!watch) {
    return;
  }
  watch.watcher.close();
  if (watch.timer) {
    clearTimeout(watch.timer);
  }
  watchesBySitePath.delete(sitePath);
}
