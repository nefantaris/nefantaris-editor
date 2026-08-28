import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import { runCoreCommand } from "./coreRunner.cjs";
import { gitLayer } from "./git/gitLayerInstance.cjs";
import { resolveIdentity } from "./git/siteSync.cjs";
import type { CreateSiteResult, NewSitePlan } from "./ipcContract.cjs";
import { recordRecentSite } from "./recentSites.cjs";
import { broadcast } from "./typedIpc.cjs";

const DEFAULT_BRANCH = "main";
const FIRST_COMMIT_MESSAGE = "First version";

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

export function defaultThemeFolder(): string | null {
  const candidate = path.resolve(
    app.getAppPath(),
    "..",
    "nefantaris-theme-base",
  );
  return fs.existsSync(candidate) ? candidate : null;
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function applySiteName(sitePath: string, siteName: string): void {
  const configPath = path.join(sitePath, "nefantaris.json");
  const parsed: unknown = JSON.parse(fs.readFileSync(configPath, "utf8"));
  if (!isJsonObject(parsed) || parsed.name === siteName) {
    return;
  }
  const config = { ...parsed, name: siteName };
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 4)}\n`);
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
  themeFolder: string,
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
  const run = await runCoreCommand([
    "init",
    plan.targetPath,
    "--theme",
    themeFolder,
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
  applySiteName(plan.targetPath, siteName);
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
