import fs from "node:fs";
import path from "node:path";
import { SITE_STYLESHEET_FILE } from "./siteStylesheet.cjs";
import { CHILD_THEME_DIR } from "./themeComponents.cjs";
import { broadcast } from "./typedIpc.cjs";

const BROADCAST_DEBOUNCE_MS = 200;

type WatchTopic = "content" | "config" | "files" | "styles" | "components";

type SiteWatch = {
  watcher: fs.FSWatcher;
  timers: Map<WatchTopic, NodeJS.Timeout>;
};

const watchesBySitePath = new Map<string, SiteWatch>();

function topicFor(relativePath: string): WatchTopic | null {
  const [topFolder] = relativePath.split("/");
  if (topFolder === "content" && relativePath !== "content") {
    return "content";
  }
  if (relativePath === "nefantaris.json") {
    return "config";
  }
  if (topFolder === "assets" || topFolder === "public") {
    return "files";
  }
  if (relativePath === SITE_STYLESHEET_FILE) {
    return "styles";
  }
  if (topFolder === CHILD_THEME_DIR) {
    return "components";
  }
  return null;
}

function announce(sitePath: string, topic: WatchTopic): void {
  switch (topic) {
    case "content": {
      broadcast("content:changed", { sitePath });
      return;
    }
    case "config": {
      broadcast("siteConfig:changed", { sitePath });
      return;
    }
    case "files": {
      broadcast("siteFiles:changed", { sitePath });
      return;
    }
    case "styles": {
      broadcast("customCss:changed", { sitePath });
      return;
    }
    case "components": {
      broadcast("components:changed", { sitePath });
      return;
    }
  }
}

function scheduleBroadcast(sitePath: string, topic: WatchTopic): void {
  const watch = watchesBySitePath.get(sitePath);
  if (!watch) {
    return;
  }
  clearTimeout(watch.timers.get(topic));
  watch.timers.set(
    topic,
    setTimeout(() => {
      watch.timers.delete(topic);
      announce(sitePath, topic);
    }, BROADCAST_DEBOUNCE_MS),
  );
}

export function watchSiteFiles(sitePath: string): void {
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
      const topic = topicFor(fileName.split(path.sep).join("/"));
      if (topic !== null) {
        scheduleBroadcast(sitePath, topic);
      }
    },
  );
  watchesBySitePath.set(sitePath, { watcher, timers: new Map() });
}

export function unwatchSiteFiles(sitePath: string): void {
  const watch = watchesBySitePath.get(sitePath);
  if (!watch) {
    return;
  }
  watch.watcher.close();
  for (const timer of watch.timers.values()) {
    clearTimeout(timer);
  }
  watchesBySitePath.delete(sitePath);
}
