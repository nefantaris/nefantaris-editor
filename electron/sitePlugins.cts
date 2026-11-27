import { coreErrorDetail, runCoreCommand } from "./coreRunner.cjs";
import type {
  AddPluginResult,
  JsonValue,
  PluginSettingResult,
  RemovePluginResult,
} from "./ipcContract.cjs";
import { readSiteConfigSnapshot } from "./siteConfig.cjs";
import { pluginNamesFrom } from "./siteInspect.cjs";
import { pinVersion, repositoryUrlFor } from "./sourcePins.cjs";

const PLUGIN_NAME_PATTERN = /^[a-z0-9][a-z0-9._-]*$/i;
const CORE_MISSING_MESSAGE =
  "This copy of the app is missing its site builder, so it can't change add-ons yet.";

type PluginOrigin = {
  name: string;
  source: string;
  isAddress: boolean;
};

const availableSources = new Set<string>();

function failed(message: string): { status: "failed"; message: string } {
  return { status: "failed", message };
}

function coreFailureMessage(
  name: string,
  verb: string,
  stderr: string,
): string {
  const detail = coreErrorDetail(stderr);
  return detail === undefined
    ? `“${name}” couldn't be ${verb}. Your site hasn't changed — you can try again.`
    : `“${name}” couldn't be ${verb}: ${detail}`;
}

function webAddressOf(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

function pluginOriginFrom(input: string): PluginOrigin | null {
  const address = webAddressOf(input);
  if (address === null) {
    return PLUGIN_NAME_PATTERN.test(input)
      ? { name: input, source: repositoryUrlFor(input), isAddress: false }
      : null;
  }
  const lastSegment =
    address.pathname
      .split("/")
      .findLast((segment) => segment !== "")
      ?.replace(/\.git$/, "") ?? "";
  return PLUGIN_NAME_PATTERN.test(lastSegment)
    ? { name: lastSegment, source: input.replace(/\/+$/, ""), isAddress: true }
    : null;
}

function unreachableMessage(origin: PluginOrigin, isOffline: boolean): string {
  if (isOffline) {
    return "You seem to be offline. Adding an add-on downloads it, so connect to the internet and try again.";
  }
  return origin.isAddress
    ? "Nothing could be downloaded from that address. Check it and try again."
    : `There's no add-on called “${origin.name}” that can be downloaded. Check the name and try again.`;
}

export async function addSitePlugin(
  sitePath: string,
  nameOrAddress: string,
): Promise<AddPluginResult> {
  const origin = pluginOriginFrom(nameOrAddress.trim());
  if (origin === null) {
    return failed(
      "Type the add-on's web address, like https://github.com/someone/nefantaris-plugin-name, or the name of one of ours.",
    );
  }
  const before = readSiteConfigSnapshot(sitePath);
  if (before.status !== "ok") {
    return failed(
      "Your site's settings couldn't be read, so add-ons can't be added right now.",
    );
  }
  if (pluginNamesFrom(before.config.plugins).includes(origin.name)) {
    return failed(`“${origin.name}” is already part of your site.`);
  }
  const pin = await pinVersion(origin.source);
  if (pin.status === "unreachable") {
    return failed(unreachableMessage(origin, pin.isOffline));
  }
  const run = await runCoreCommand([
    "plugins",
    "add",
    origin.name,
    sitePath,
    "--source",
    origin.source,
    "--version",
    pin.version,
  ]);
  if (run.status === "core-missing") {
    return failed(CORE_MISSING_MESSAGE);
  }
  if (run.exitCode !== 0) {
    return failed(coreFailureMessage(origin.name, "added", run.stderr));
  }
  return { status: "added", snapshot: readSiteConfigSnapshot(sitePath) };
}

export async function removeSitePlugin(
  sitePath: string,
  rawName: string,
): Promise<RemovePluginResult> {
  const name = rawName.trim();
  const before = readSiteConfigSnapshot(sitePath);
  if (before.status !== "ok") {
    return failed(
      "Your site's settings couldn't be read, so add-ons can't be removed right now.",
    );
  }
  if (!pluginNamesFrom(before.config.plugins).includes(name)) {
    return { status: "removed", snapshot: before };
  }
  const run = await runCoreCommand(["plugins", "remove", name, sitePath]);
  if (run.status === "core-missing") {
    return failed(CORE_MISSING_MESSAGE);
  }
  if (run.exitCode !== 0) {
    return failed(coreFailureMessage(name, "removed", run.stderr));
  }
  return { status: "removed", snapshot: readSiteConfigSnapshot(sitePath) };
}

export async function isPluginAvailable(name: string): Promise<boolean> {
  if (!PLUGIN_NAME_PATTERN.test(name)) {
    return false;
  }
  const source = repositoryUrlFor(name);
  if (availableSources.has(source)) {
    return true;
  }
  const pin = await pinVersion(source);
  if (pin.status !== "pinned") {
    return false;
  }
  availableSources.add(source);
  return true;
}

function settingValueText(value: JsonValue): string | null {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return JSON.stringify(value);
  }
  return null;
}

async function runSettingCommand(
  sitePath: string,
  args: string[],
): Promise<PluginSettingResult> {
  const unchanged = (message: string): PluginSettingResult => ({
    status: "failed",
    message,
    snapshot: readSiteConfigSnapshot(sitePath),
  });
  const run = await runCoreCommand(["plugins", ...args, sitePath]);
  if (run.status === "core-missing") {
    return unchanged(CORE_MISSING_MESSAGE);
  }
  if (run.exitCode !== 0) {
    const detail = coreErrorDetail(run.stderr);
    return unchanged(
      detail === undefined
        ? "That setting couldn't be saved. Your site hasn't changed — you can try again."
        : `That setting couldn't be saved: ${detail}`,
    );
  }
  return { status: "saved", snapshot: readSiteConfigSnapshot(sitePath) };
}

export function setPluginSetting(
  sitePath: string,
  name: string,
  setting: string,
  value: JsonValue,
): Promise<PluginSettingResult> {
  const text = settingValueText(value);
  if (text === null) {
    return Promise.resolve({
      status: "failed",
      message: "That setting isn't one this add-on can save.",
      snapshot: readSiteConfigSnapshot(sitePath),
    });
  }
  return runSettingCommand(sitePath, ["set", name, setting, text]);
}

export function unsetPluginSetting(
  sitePath: string,
  name: string,
  setting: string,
): Promise<PluginSettingResult> {
  return runSettingCommand(sitePath, ["unset", name, setting]);
}
