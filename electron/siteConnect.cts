import type { BrowserWindow, OpenDialogOptions } from "electron";
import { dialog } from "electron";
import fs from "node:fs";
import path from "node:path";
import { gitLayer } from "./git/gitLayerInstance.cjs";
import type { ConnectSiteResult } from "./ipcContract.cjs";
import { recordRecentSite } from "./recentSites.cjs";
import { validateSiteFolder } from "./siteValidation.cjs";
import { broadcast } from "./typedIpc.cjs";
import { openSiteWindow } from "./windows.cjs";

const discardableClonePaths = new Set<string>();

function repoFolderName(repoFullName: string): string {
  const slashAt = repoFullName.lastIndexOf("/");
  return slashAt === -1 ? repoFullName : repoFullName.slice(slashAt + 1);
}

export async function pickParentFolder(
  owner: BrowserWindow | null,
): Promise<string | null> {
  const options: OpenDialogOptions = {
    title: "Choose where to keep your site",
    buttonLabel: "Put it here",
    properties: ["openDirectory", "createDirectory"],
  };
  const picked = owner
    ? await dialog.showOpenDialog(owner, options)
    : await dialog.showOpenDialog(options);
  const chosenPath = picked.filePaths[0];
  if (picked.canceled || chosenPath === undefined) {
    return null;
  }
  return chosenPath;
}

export async function connectExistingSite(
  owner: BrowserWindow | null,
  cloneUrl: string,
  repoFullName: string,
): Promise<ConnectSiteResult> {
  const parentFolder = await pickParentFolder(owner);
  if (parentFolder === null) {
    return { status: "cancelled" };
  }
  const targetPath = path.join(parentFolder, repoFolderName(repoFullName));
  if (fs.existsSync(targetPath)) {
    return { status: "folder-exists", path: targetPath };
  }
  try {
    await gitLayer.cloneRepo(cloneUrl, targetPath, (progress) => {
      broadcast("connect:progress", { targetPath, ...progress });
    });
  } catch (error) {
    fs.rmSync(targetPath, { recursive: true, force: true });
    switch (gitLayer.classifyFailure(error)) {
      case "offline":
        return { status: "offline" };
      case "auth-needed":
        return { status: "auth-needed" };
      default:
        return { status: "failed" };
    }
  }
  const validation = validateSiteFolder(targetPath);
  if (!validation.ok) {
    discardableClonePaths.add(targetPath);
    return { status: "invalid", path: targetPath, reason: validation.reason };
  }
  const recents = recordRecentSite({
    path: targetPath,
    name: validation.siteName,
    lastOpenedAt: Date.now(),
  });
  broadcast("recentSites:changed", recents);
  openSiteWindow(targetPath, validation.siteName);
  return { status: "connected", siteName: validation.siteName };
}

export function discardClonedFolder(folderPath: string): null {
  if (!discardableClonePaths.has(folderPath)) {
    return null;
  }
  discardableClonePaths.delete(folderPath);
  fs.rmSync(folderPath, { recursive: true, force: true });
  return null;
}
