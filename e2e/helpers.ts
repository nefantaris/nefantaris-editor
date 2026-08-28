import type { ElectronApplication } from "@playwright/test";
import { _electron as electron } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const appRoot = fileURLToPath(new URL("..", import.meta.url));
const requireFromRoot = createRequire(path.join(appRoot, "package.json"));

const tempDirs: string[] = [];
const launchedApps: ElectronApplication[] = [];

function resolveElectronBinary(): string {
  const electronExport: unknown = requireFromRoot("electron");
  if (typeof electronExport !== "string") {
    throw new TypeError(
      "Could not resolve the Electron binary from the root package",
    );
  }
  return electronExport;
}

function inheritedEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === "string") {
      env[key] = value;
    }
  }
  return env;
}

export async function createTempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

export async function launchEditor(
  userDataDir: string,
  extraEnv: Record<string, string> = {},
): Promise<ElectronApplication> {
  const app = await electron.launch({
    executablePath: resolveElectronBinary(),
    args: [appRoot],
    env: {
      ...inheritedEnv(),
      NEFANTARIS_USER_DATA_DIR: userDataDir,
      ...extraEnv,
    },
  });
  launchedApps.push(app);
  return app;
}

export async function stubDirectoryPicker(
  app: ElectronApplication,
  chosenPath: string,
): Promise<void> {
  await app.evaluate(({ dialog }, folderPath) => {
    dialog.showOpenDialog = () =>
      Promise.resolve({ canceled: false, filePaths: [folderPath] });
  }, chosenPath);
}

export async function cleanupTestArtifacts(): Promise<void> {
  await Promise.allSettled(launchedApps.splice(0).map((app) => app.close()));
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
}
