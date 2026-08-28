import type { OpenDialogOptions } from "electron";
import { BrowserWindow, dialog, shell } from "electron";
import path from "node:path";
import {
  createPage,
  createPost,
  deleteContentFile,
  readContentFile,
  renameContentFile,
  saveAsset,
  writeContentFile,
} from "./contentFiles.cjs";
import { buildContentTree } from "./contentTree.cjs";
import {
  getPreviewStatus,
  startPreviewServer,
  stopPreviewServer,
} from "./devServer.cjs";
import { gitLayer } from "./git/gitLayerInstance.cjs";
import {
  cancelSiteMerge,
  checkSiteSync,
  completeSiteMerge,
  getSiteSyncSnapshot,
  listSiteVersions,
  publishSite,
  updateSiteFromOnline,
} from "./git/siteSync.cjs";
import { createUserRepo, listUserRepos } from "./githubApi.cjs";
import {
  cancelSignIn,
  getAuthStatus,
  signOut,
  startSignIn,
} from "./githubAuth.cjs";
import type { OpenSiteResult } from "./ipcContract.cjs";
import {
  loadRecentSites,
  recordRecentSite,
  removeRecentSite,
} from "./recentSites.cjs";
import {
  connectExistingSite,
  discardClonedFolder,
  pickParentFolder,
} from "./siteConnect.cjs";
import {
  createNewSite,
  defaultThemeFolder,
  planNewSite,
} from "./siteCreate.cjs";
import { inspectSite } from "./siteInspect.cjs";
import { validateSiteFolder } from "./siteValidation.cjs";
import { broadcast, handleInvoke } from "./typedIpc.cjs";
import { getWindowContext, openSiteWindow } from "./windows.cjs";

function openSiteAtPath(rawPath: string): OpenSiteResult {
  const sitePath = path.resolve(rawPath);
  const validation = validateSiteFolder(sitePath);
  if (!validation.ok) {
    return { status: "invalid", path: sitePath, reason: validation.reason };
  }
  const recents = recordRecentSite({
    path: sitePath,
    name: validation.siteName,
    lastOpenedAt: Date.now(),
  });
  broadcast("recentSites:changed", recents);
  openSiteWindow(sitePath, validation.siteName);
  return { status: "opened", siteName: validation.siteName };
}

export function registerIpcHandlers(): void {
  handleInvoke("window:getContext", (event) =>
    getWindowContext(event.sender.id),
  );

  handleInvoke("sites:openFromDialog", async (event) => {
    const owner = BrowserWindow.fromWebContents(event.sender);
    const options: OpenDialogOptions = {
      title: "Open a Nefantaris site",
      properties: ["openDirectory"],
    };
    const picked = owner
      ? await dialog.showOpenDialog(owner, options)
      : await dialog.showOpenDialog(options);
    const chosenPath = picked.filePaths[0];
    if (picked.canceled || chosenPath === undefined) {
      return { status: "cancelled" };
    }
    return openSiteAtPath(chosenPath);
  });

  handleInvoke("sites:open", (_event, sitePath) => openSiteAtPath(sitePath));

  handleInvoke("recentSites:list", () => loadRecentSites());

  handleInvoke("recentSites:remove", (_event, sitePath) => {
    const recents = removeRecentSite(sitePath);
    broadcast("recentSites:changed", recents);
    return recents;
  });

  handleInvoke("content:getTree", (_event, sitePath) =>
    buildContentTree(sitePath),
  );

  handleInvoke("content:readFile", (_event, sitePath, relativePath) =>
    readContentFile(sitePath, relativePath),
  );

  handleInvoke("content:writeFile", (_event, sitePath, relativePath, text) => {
    writeContentFile(sitePath, relativePath, text);
    return null;
  });

  handleInvoke("content:createPage", (_event, sitePath, folder, title) =>
    createPage(sitePath, folder, title),
  );

  handleInvoke("content:createPost", (_event, sitePath, title) =>
    createPost(sitePath, title),
  );

  handleInvoke("content:renameFile", (_event, sitePath, relativePath, name) =>
    renameContentFile(sitePath, relativePath, name),
  );

  handleInvoke("content:deleteFile", (_event, sitePath, relativePath) =>
    deleteContentFile(sitePath, relativePath),
  );

  handleInvoke("content:saveAsset", (_event, sitePath, mimeType, base, bytes) =>
    saveAsset(sitePath, mimeType, base, bytes),
  );

  handleInvoke("site:inspect", (_event, sitePath) => inspectSite(sitePath));

  handleInvoke("preview:start", (_event, sitePath) =>
    startPreviewServer(sitePath),
  );

  handleInvoke("preview:stop", async (_event, sitePath) => {
    await stopPreviewServer(sitePath);
    return null;
  });

  handleInvoke("preview:getStatus", (_event, sitePath) =>
    getPreviewStatus(sitePath),
  );

  handleInvoke("sync:get", (_event, sitePath) => getSiteSyncSnapshot(sitePath));

  handleInvoke("sync:check", (_event, sitePath) => checkSiteSync(sitePath));

  handleInvoke("sync:update", (_event, sitePath) =>
    updateSiteFromOnline(sitePath),
  );

  handleInvoke("publish:run", (_event, sitePath, note) =>
    publishSite(sitePath, note),
  );

  handleInvoke("merge:complete", (_event, sitePath, choices) =>
    completeSiteMerge(sitePath, choices),
  );

  handleInvoke("merge:cancel", (_event, sitePath) => cancelSiteMerge(sitePath));

  handleInvoke("versions:list", (_event, sitePath) =>
    listSiteVersions(sitePath),
  );

  handleInvoke("auth:getStatus", () => getAuthStatus());

  handleInvoke("auth:startSignIn", () => startSignIn());

  handleInvoke("auth:cancelSignIn", () => {
    cancelSignIn();
    return null;
  });

  handleInvoke("auth:signOut", () => {
    signOut();
    return null;
  });

  handleInvoke("repos:list", () => listUserRepos());

  handleInvoke("repos:create", (_event, name) => createUserRepo(name));

  handleInvoke("sites:connect", (event, cloneUrl, repoFullName) =>
    connectExistingSite(
      BrowserWindow.fromWebContents(event.sender),
      cloneUrl,
      repoFullName,
    ),
  );

  handleInvoke("sites:discardClone", (_event, folderPath) =>
    discardClonedFolder(folderPath),
  );

  handleInvoke("sites:pickCreateParent", (event) =>
    pickParentFolder(BrowserWindow.fromWebContents(event.sender)),
  );

  handleInvoke("sites:planCreate", (_event, parentFolder, siteName) =>
    planNewSite(parentFolder, siteName),
  );

  handleInvoke("sites:defaultThemeFolder", () => defaultThemeFolder());

  handleInvoke("sites:create", (_event, parentFolder, siteName, themeFolder) =>
    createNewSite(parentFolder, siteName, themeFolder),
  );

  handleInvoke("sites:setOnlineRemote", async (_event, sitePath, remoteUrl) => {
    await gitLayer.addRemote(sitePath, "origin", remoteUrl);
    return null;
  });

  handleInvoke("liveness:check", (_event, url) => checkLiveness(url));

  handleInvoke("system:openExternal", async (_event, url) => {
    const parsed = parseUrlOrNull(url);
    if (
      parsed &&
      (parsed.protocol === "http:" || parsed.protocol === "https:")
    ) {
      await shell.openExternal(parsed.toString());
    }
    return null;
  });
}

function parseUrlOrNull(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

const LIVENESS_PROBE_TIMEOUT_MS = 4000;

async function probeStatus(url: string, method: string): Promise<number> {
  const response = await fetch(url, {
    method,
    redirect: "follow",
    signal: AbortSignal.timeout(LIVENESS_PROBE_TIMEOUT_MS),
  });
  return response.status;
}

async function checkLiveness(url: string): Promise<boolean> {
  const parsed = parseUrlOrNull(url);
  if (
    parsed === null ||
    (parsed.protocol !== "http:" && parsed.protocol !== "https:")
  ) {
    return false;
  }
  let headStatus: number;
  try {
    headStatus = await probeStatus(parsed.toString(), "HEAD");
  } catch {
    return false;
  }
  if (headStatus === 200) {
    return true;
  }
  if (headStatus !== 405 && headStatus !== 501) {
    return false;
  }
  try {
    return (await probeStatus(parsed.toString(), "GET")) === 200;
  } catch {
    return false;
  }
}
