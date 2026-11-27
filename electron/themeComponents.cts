import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type {
  ComponentComparison,
  ComponentListing,
  ComponentOverrideState,
  CustomizeComponentResult,
  InspectedTheme,
  ReadContentFileResult,
  SaveComponentResult,
} from "./ipcContract.cjs";
import { resolveInside } from "./pathConfinement.cjs";
import { resolvedThemeOf } from "./siteInspect.cjs";

export const CHILD_THEME_DIR = "child-theme";

const SIDECAR_FILE = ".nefantaris-overrides.json";
const ORIGINALS_DIR = ".nefantaris-originals";
const ORIGINALS_ROOT = `${CHILD_THEME_DIR}/${ORIGINALS_DIR}`;

const customizablePattern = /\.(?:tsx|ts|jsx|js|mjs|css)$/;

type SidecarEntry = {
  themeVersion: string | null;
  originalHash: string;
};

type Sidecar = Record<string, SidecarEntry>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isComponentPath(filePath: string): boolean {
  if (
    filePath === "" ||
    filePath.includes("\\") ||
    filePath.includes("\0") ||
    path.posix.isAbsolute(filePath)
  ) {
    return false;
  }
  return filePath
    .split("/")
    .every((segment) => segment !== "" && !segment.startsWith("."));
}

function checkedComponentPath(filePath: string): string {
  if (!isComponentPath(filePath)) {
    throw new Error(`Not a theme component path: ${filePath}`);
  }
  return filePath;
}

function overridePath(sitePath: string, filePath: string): string {
  return resolveInside(
    sitePath,
    `${CHILD_THEME_DIR}/${checkedComponentPath(filePath)}`,
    CHILD_THEME_DIR,
  );
}

function originalPath(sitePath: string, filePath: string): string {
  return resolveInside(
    sitePath,
    `${ORIGINALS_ROOT}/${checkedComponentPath(filePath)}`,
    ORIGINALS_ROOT,
  );
}

function themeFilePath(theme: InspectedTheme, filePath: string): string {
  return resolveInside(theme.dir, checkedComponentPath(filePath), ".");
}

function sidecarPath(sitePath: string): string {
  return path.join(sitePath, CHILD_THEME_DIR, SIDECAR_FILE);
}

function readBytesOrNull(filePath: string): Buffer | null {
  try {
    return fs.readFileSync(filePath);
  } catch {
    return null;
  }
}

function hashOf(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function writeMakingFolders(filePath: string, contents: Buffer | string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
}

function sidecarEntryFrom(value: unknown): SidecarEntry | null {
  if (!isRecord(value) || typeof value.originalHash !== "string") {
    return null;
  }
  return {
    themeVersion:
      typeof value.themeVersion === "string" ? value.themeVersion : null,
    originalHash: value.originalHash,
  };
}

function readSidecar(sitePath: string): Sidecar {
  const bytes = readBytesOrNull(sidecarPath(sitePath));
  if (bytes === null) {
    return {};
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString("utf8"));
  } catch {
    return {};
  }
  if (!isRecord(parsed)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(parsed).flatMap(
      ([filePath, value]): [string, SidecarEntry][] => {
        const entry = sidecarEntryFrom(value);
        return entry === null ? [] : [[filePath, entry]];
      },
    ),
  );
}

function writeSidecar(sitePath: string, sidecar: Sidecar): void {
  const entries = Object.entries(sidecar).toSorted(([first], [second]) =>
    first.localeCompare(second),
  );
  if (entries.length === 0) {
    fs.rmSync(sidecarPath(sitePath), { force: true });
    return;
  }
  writeMakingFolders(
    sidecarPath(sitePath),
    `${JSON.stringify(Object.fromEntries(entries), null, 2)}\n`,
  );
}

function pruneEmptyFolders(from: string, stopAt: string): void {
  let folder = from;
  while (folder.startsWith(stopAt + path.sep) && fs.existsSync(folder)) {
    if (fs.readdirSync(folder).length > 0) {
      return;
    }
    fs.rmdirSync(folder);
    folder = path.dirname(folder);
  }
}

function overrideStateOf(
  theme: InspectedTheme,
  filePath: string,
  entry: SidecarEntry | undefined,
): ComponentOverrideState {
  if (entry === undefined) {
    return "untracked";
  }
  const current = readBytesOrNull(themeFilePath(theme, filePath));
  return current === null || hashOf(current) === entry.originalHash
    ? "current"
    : "theme-changed";
}

export async function listComponents(
  sitePath: string,
): Promise<ComponentListing> {
  const theme = await resolvedThemeOf(sitePath);
  if (theme === null) {
    return { status: "unavailable" };
  }
  const sidecar = readSidecar(sitePath);
  return {
    status: "ok",
    themeName: theme.name,
    themeVersion: theme.version,
    files: theme.files.filter((filePath) => isComponentPath(filePath)),
    overrides: theme.overrides
      .filter((filePath) => isComponentPath(filePath))
      .map((filePath) => ({
        path: filePath,
        state: overrideStateOf(theme, filePath, sidecar[filePath]),
      })),
  };
}

export async function customizeComponent(
  sitePath: string,
  filePath: string,
): Promise<CustomizeComponentResult> {
  const theme = await resolvedThemeOf(sitePath);
  if (theme === null) {
    return { status: "failed", reason: "theme-unavailable" };
  }
  if (
    !isComponentPath(filePath) ||
    !customizablePattern.test(filePath) ||
    !theme.files.includes(filePath)
  ) {
    return { status: "failed", reason: "not-a-theme-file" };
  }
  const target = overridePath(sitePath, filePath);
  if (fs.existsSync(target)) {
    return { status: "failed", reason: "already-customized" };
  }
  const original = fs.readFileSync(themeFilePath(theme, filePath));
  writeMakingFolders(originalPath(sitePath, filePath), original);
  writeSidecar(sitePath, {
    ...readSidecar(sitePath),
    [filePath]: { themeVersion: theme.version, originalHash: hashOf(original) },
  });
  writeMakingFolders(target, original);
  return { status: "customized" };
}

export function readComponent(
  sitePath: string,
  filePath: string,
): ReadContentFileResult {
  const bytes = readBytesOrNull(overridePath(sitePath, filePath));
  return bytes === null
    ? { status: "missing" }
    : { status: "ok", text: bytes.toString("utf8") };
}

export function writeComponent(
  sitePath: string,
  filePath: string,
  text: string,
): SaveComponentResult {
  const target = overridePath(sitePath, filePath);
  if (!fs.existsSync(target)) {
    return { status: "missing" };
  }
  fs.writeFileSync(target, text, "utf8");
  return { status: "saved" };
}

export function resetComponent(sitePath: string, filePath: string): void {
  const target = overridePath(sitePath, filePath);
  const original = originalPath(sitePath, filePath);
  fs.rmSync(target, { force: true });
  fs.rmSync(original, { force: true });
  const { [filePath]: _removed, ...remaining } = readSidecar(sitePath);
  writeSidecar(sitePath, remaining);
  const childThemeRoot = path.join(sitePath, CHILD_THEME_DIR);
  pruneEmptyFolders(path.dirname(target), childThemeRoot);
  pruneEmptyFolders(path.dirname(original), childThemeRoot);
}

export async function compareComponent(
  sitePath: string,
  filePath: string,
): Promise<ComponentComparison> {
  const mine = readBytesOrNull(overridePath(sitePath, filePath));
  if (mine === null) {
    return { status: "missing" };
  }
  const theme = await resolvedThemeOf(sitePath);
  const themeBytes =
    theme === null ? null : readBytesOrNull(themeFilePath(theme, filePath));
  const original = readBytesOrNull(originalPath(sitePath, filePath));
  return {
    status: "ok",
    theme: themeBytes?.toString("utf8") ?? null,
    mine: mine.toString("utf8"),
    original: original?.toString("utf8") ?? null,
    customizedFromVersion:
      readSidecar(sitePath)[filePath]?.themeVersion ?? null,
    themeVersion: theme?.version ?? null,
  };
}

export async function keepMyComponent(
  sitePath: string,
  filePath: string,
): Promise<void> {
  if (!fs.existsSync(overridePath(sitePath, filePath))) {
    return;
  }
  const theme = await resolvedThemeOf(sitePath);
  const current =
    theme === null ? null : readBytesOrNull(themeFilePath(theme, filePath));
  if (theme === null || current === null) {
    return;
  }
  writeMakingFolders(originalPath(sitePath, filePath), current);
  writeSidecar(sitePath, {
    ...readSidecar(sitePath),
    [filePath]: { themeVersion: theme.version, originalHash: hashOf(current) },
  });
}
