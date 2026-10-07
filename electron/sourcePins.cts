import fs from "node:fs";
import path from "node:path";
import { gitLayer } from "./git/gitLayerInstance.cjs";

const DEFAULT_CLONE_BASE = "https://github.com/nefantaris";
const RELEASE_TAG_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)$/;

type ReleaseTag = { name: string; parts: number[] };

export type PinResult =
  | { status: "pinned"; version: string }
  | { status: "unreachable"; isOffline: boolean };

export type PluginPinResult =
  | { status: "pinned" }
  | {
      status: "unreachable";
      isOffline: boolean;
      pluginName: string;
      url: string;
    };

export function repositoryUrlFor(name: string): string {
  const cloneBase = process.env.NEFANTARIS_CLONE_BASE || DEFAULT_CLONE_BASE;
  return `${cloneBase.replace(/\/+$/, "")}/${name}`;
}

function releaseTagFrom(name: string): ReleaseTag | null {
  const match = RELEASE_TAG_PATTERN.exec(name);
  return match ? { name, parts: match.slice(1).map(Number) } : null;
}

function compareReleaseTags(first: ReleaseTag, second: ReleaseTag): number {
  for (const [index, part] of first.parts.entries()) {
    const difference = part - (second.parts[index] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
}

function newestReleaseTag(tagNames: string[]): string | null {
  const [newest] = tagNames
    .map((name) => releaseTagFrom(name))
    .filter((tag): tag is ReleaseTag => tag !== null)
    .toSorted((first, second) => compareReleaseTags(second, first));
  return newest?.name ?? null;
}

async function resolvePinnedVersion(url: string): Promise<string | null> {
  const newestTag = newestReleaseTag(await gitLayer.listRemoteTags(url));
  return newestTag ?? (await gitLayer.getRemoteHead(url));
}

export async function pinVersion(url: string): Promise<PinResult> {
  try {
    const version = await resolvePinnedVersion(url);
    return version === null
      ? { status: "unreachable", isOffline: false }
      : { status: "pinned", version };
  } catch (error) {
    return {
      status: "unreachable",
      isOffline: gitLayer.classifyFailure(error) === "offline",
    };
  }
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function pinNamedPlugins(
  sitePath: string,
): Promise<PluginPinResult> {
  const configPath = path.join(sitePath, "nefantaris.json");
  const config: unknown = JSON.parse(fs.readFileSync(configPath, "utf8"));
  if (!isJsonObject(config) || !Array.isArray(config.plugins)) {
    return { status: "pinned" };
  }
  const entries: unknown[] = config.plugins;
  if (entries.every((entry) => typeof entry !== "string")) {
    return { status: "pinned" };
  }
  const plugins: unknown[] = [];
  for (const entry of entries) {
    if (typeof entry !== "string") {
      plugins.push(entry);
      continue;
    }
    const source = repositoryUrlFor(entry);
    const pin = await pinVersion(source);
    if (pin.status === "unreachable") {
      return { ...pin, pluginName: entry, url: source };
    }
    plugins.push({ name: entry, source, version: pin.version });
  }
  fs.writeFileSync(
    configPath,
    `${JSON.stringify({ ...config, plugins }, null, 4)}\n`,
  );
  return { status: "pinned" };
}
