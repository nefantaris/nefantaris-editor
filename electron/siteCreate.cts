import fs from "node:fs";
import path from "node:path";
import { runCoreCommand } from "./coreRunner.cjs";
import { gitLayer } from "./git/gitLayerInstance.cjs";
import { resolveIdentity } from "./git/siteSync.cjs";
import type {
  CreateSiteResult,
  NewSitePlan,
  ThemeChoice,
} from "./ipcContract.cjs";
import { recordRecentSite } from "./recentSites.cjs";
import {
  pinNamedPlugins,
  pinVersion,
  repositoryUrlFor,
} from "./sourcePins.cjs";
import { broadcast } from "./typedIpc.cjs";

const DEFAULT_BRANCH = "main";
const FIRST_COMMIT_MESSAGE = "First version";
const OFFLINE_MESSAGE =
  "You seem to be offline. Creating a site downloads its theme, so connect to the internet and try again.";
const THEME_LINK_MESSAGE =
  "Paste the theme's web address. It starts with https://, like https://github.com/you/your-theme.";

function folderNameFor(siteName: string): string {
  return siteName
    .normalize("NFKD")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");
}

export function planNewSite(
  parentFolder: string,
  siteName: string,
): NewSitePlan {
  const folderName = folderNameFor(siteName);
  if (folderName === "" || parentFolder === "") {
    return { folderName, targetPath: null, isTaken: false };
  }
  const targetPath = path.join(parentFolder, folderName);
  return { folderName, targetPath, isTaken: fs.existsSync(targetPath) };
}

function isWebAddress(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

function themeUrlFor(theme: ThemeChoice): string | null {
  if (theme.kind === "firstParty") {
    return repositoryUrlFor(theme.name);
  }
  const url = theme.url.trim();
  return isWebAddress(url) ? url : null;
}

function unreachableMessage(isOffline: boolean, notFound: string): string {
  return isOffline ? OFFLINE_MESSAGE : notFound;
}

function initFailureMessage(stderr: string): string {
  const detail = stderr
    .split("\n")
    .map((line) => line.trim())
    .findLast((line) => line !== "");
  if (detail === undefined) {
    return "Something went wrong while creating your site. Nothing was left behind — you can try again.";
  }
  return `Your site couldn't be created: ${detail}`;
}

export async function createNewSite(
  parentFolder: string,
  siteName: string,
  theme: ThemeChoice,
): Promise<CreateSiteResult> {
  const plan = planNewSite(parentFolder, siteName);
  if (plan.targetPath === null) {
    return {
      status: "failed",
      message: "Give your site a name with at least one letter or number.",
    };
  }
  if (plan.isTaken) {
    return { status: "folder-exists", path: plan.targetPath };
  }
  const themeUrl = themeUrlFor(theme);
  if (themeUrl === null) {
    return { status: "failed", message: THEME_LINK_MESSAGE };
  }
  const themePin = await pinVersion(themeUrl);
  if (themePin.status === "unreachable") {
    return {
      status: "failed",
      message: unreachableMessage(
        themePin.isOffline,
        `There's no theme at ${themeUrl} that can be downloaded. Check the address — the theme has to be a public git repository.`,
      ),
    };
  }
  const run = await runCoreCommand([
    "init",
    plan.targetPath,
    "--theme",
    themeUrl,
    "--theme-version",
    themePin.version,
    "--name",
    siteName,
  ]);
  if (run.status === "core-missing") {
    return {
      status: "failed",
      message:
        "This copy of the app is missing its site builder, so it can't create sites yet.",
    };
  }
  if (run.exitCode !== 0) {
    fs.rmSync(plan.targetPath, { recursive: true, force: true });
    return { status: "failed", message: initFailureMessage(run.stderr) };
  }
  const pluginPin = await pinNamedPlugins(plan.targetPath);
  if (pluginPin.status === "unreachable") {
    fs.rmSync(plan.targetPath, { recursive: true, force: true });
    return {
      status: "failed",
      message: unreachableMessage(
        pluginPin.isOffline,
        `Your theme needs the add-on “${pluginPin.pluginName}”, but it couldn't be downloaded from ${pluginPin.url}.`,
      ),
    };
  }
  await gitLayer.initRepo(plan.targetPath, DEFAULT_BRANCH);
  await gitLayer.commitAll(
    plan.targetPath,
    FIRST_COMMIT_MESSAGE,
    await resolveIdentity(plan.targetPath),
  );
  const recents = recordRecentSite({
    path: plan.targetPath,
    name: siteName,
    lastOpenedAt: Date.now(),
  });
  broadcast("recentSites:changed", recents);
  return {
    status: "created",
    sitePath: plan.targetPath,
    siteName,
    folderName: plan.folderName,
  };
}
