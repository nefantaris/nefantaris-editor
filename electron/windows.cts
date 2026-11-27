import type { BrowserWindowConstructorOptions } from "electron";
import { BrowserWindow, dialog, nativeTheme } from "electron";
import path from "node:path";
import { stopPreviewServer } from "./devServer.cjs";
import { checkSiteSync, forgetSiteSync } from "./git/siteSync.cjs";
import type { WindowContext } from "./ipcContract.cjs";
import { unwatchSiteFiles, watchSiteFiles } from "./siteWatcher.cjs";

const contextsByWebContentsId = new Map<number, WindowContext>();
const siteWindowsByPath = new Map<string, BrowserWindow>();
let welcomeWindow: BrowserWindow | null = null;

function loadRenderer(window: BrowserWindow): void {
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    void window.loadURL(devServerUrl);
  } else {
    void window.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

function createAppWindow(
  options: BrowserWindowConstructorOptions,
  context: WindowContext,
): BrowserWindow {
  const window = new BrowserWindow({
    ...options,
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#141413" : "#f6f5f3",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });
  const webContentsId = window.webContents.id;
  contextsByWebContentsId.set(webContentsId, context);
  window.on("closed", () => {
    contextsByWebContentsId.delete(webContentsId);
  });
  loadRenderer(window);
  return window;
}

export function renameSiteWindow(sitePath: string, siteName: string): void {
  const window = siteWindowsByPath.get(sitePath);
  if (!window) {
    return;
  }
  contextsByWebContentsId.set(window.webContents.id, {
    kind: "site",
    sitePath,
    siteName,
  });
}

export function hasOpenSite(sitePath: string): boolean {
  return siteWindowsByPath.has(sitePath);
}

export function getWindowContext(webContentsId: number): WindowContext {
  const context = contextsByWebContentsId.get(webContentsId);
  if (!context) {
    throw new Error(`No window context for webContents ${webContentsId}`);
  }
  return context;
}

export function createWelcomeWindow(): void {
  if (welcomeWindow) {
    welcomeWindow.focus();
    return;
  }
  const window = createAppWindow(
    {
      width: 760,
      height: 560,
      minWidth: 760,
      minHeight: 560,
      title: "Nefantaris",
    },
    { kind: "welcome" },
  );
  welcomeWindow = window;
  window.on("closed", () => {
    welcomeWindow = null;
  });
}

function closeWelcomeWindow(): void {
  welcomeWindow?.close();
}

function confirmCloseWithUnsavedCss(window: BrowserWindow): boolean {
  const choice = dialog.showMessageBoxSync(window, {
    type: "warning",
    buttons: ["Keep editing", "Close anyway"],
    defaultId: 0,
    cancelId: 0,
    message: "Your CSS isn't saved yet",
    detail:
      "A rule in your custom CSS isn't finished, so it hasn't been saved. If you close now, the unfinished changes are lost.",
  });
  return choice === 1;
}

export function openSiteWindow(sitePath: string, siteName: string): void {
  const existing = siteWindowsByPath.get(sitePath);
  if (existing) {
    if (existing.isMinimized()) {
      existing.restore();
    }
    existing.focus();
    closeWelcomeWindow();
    return;
  }
  const window = createAppWindow(
    {
      width: 1280,
      height: 800,
      minWidth: 940,
      minHeight: 600,
      title: siteName,
    },
    { kind: "site", sitePath, siteName },
  );
  siteWindowsByPath.set(sitePath, window);
  window.webContents.on("will-prevent-unload", (event) => {
    if (confirmCloseWithUnsavedCss(window)) {
      event.preventDefault();
    }
  });
  watchSiteFiles(sitePath);
  void checkSiteSync(sitePath);
  window.on("closed", () => {
    siteWindowsByPath.delete(sitePath);
    unwatchSiteFiles(sitePath);
    forgetSiteSync(sitePath);
    void stopPreviewServer(sitePath);
  });
  closeWelcomeWindow();
}
