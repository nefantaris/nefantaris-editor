import type { BrowserWindowConstructorOptions } from "electron";
import { BrowserWindow } from "electron";
import path from "node:path";
import { unwatchSiteContent, watchSiteContent } from "./contentWatcher.cjs";
import { stopPreviewServer } from "./devServer.cjs";
import { checkSiteSync, forgetSiteSync } from "./git/siteSync.cjs";
import type { WindowContext } from "./ipcContract.cjs";

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
    { width: 760, height: 560, resizable: false, title: "Nefantaris" },
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
  watchSiteContent(sitePath);
  void checkSiteSync(sitePath);
  window.on("closed", () => {
    siteWindowsByPath.delete(sitePath);
    unwatchSiteContent(sitePath);
    forgetSiteSync(sitePath);
    void stopPreviewServer(sitePath);
  });
  closeWelcomeWindow();
}
