import type {
  JsonObject,
  JsonValue,
  PluginDetail,
  PluginHeadTag,
  SiteInspection,
  ThemeSettingDefinition,
} from "../../../electron/ipcContract.cts";
import type { CatalogAddOn } from "./addOnCatalog.ts";
import type { StoredSettings } from "./designModel.ts";
import { isJsonObject, pluginRowsFrom } from "./siteSettingsModel.ts";

export type AddOnStatus =
  "added" | "requiredByTheme" | "available" | "comingSoon" | "checking";

export type EnabledAddOn = {
  name: string;
  version: string | null;
  isRequiredByTheme: boolean;
};

export const addOnStatusLabels: Record<AddOnStatus, string> = {
  added: "Added",
  requiredByTheme: "Needed by your theme",
  available: "Available",
  comingSoon: "Coming soon",
  checking: "Checking…",
};

export function enabledAddOnsFrom(
  config: JsonObject,
  inspection: SiteInspection | null,
): EnabledAddOn[] {
  const requiredNames = new Set(
    (inspection?.pluginDetails ?? [])
      .filter((detail) => detail.requiredByTheme)
      .map((detail) => detail.name),
  );
  return pluginRowsFrom(config).map((row) => ({
    ...row,
    isRequiredByTheme: requiredNames.has(row.name),
  }));
}

export function addOnStatusFor(
  addOn: CatalogAddOn,
  enabled: EnabledAddOn | undefined,
  isOnline: boolean | undefined,
): AddOnStatus {
  if (enabled !== undefined) {
    return enabled.isRequiredByTheme ? "requiredByTheme" : "added";
  }
  if (addOn.availability === "comingSoon") {
    return "comingSoon";
  }
  if (addOn.availability === "ready") {
    return "available";
  }
  if (isOnline === undefined) {
    return "checking";
  }
  return isOnline ? "available" : "comingSoon";
}

export function pluginDetailFor(
  inspection: SiteInspection | null,
  name: string,
): PluginDetail | undefined {
  return inspection?.pluginDetails?.find((detail) => detail.name === name);
}

export function hasProvides(detail: PluginDetail): boolean {
  return (
    detail.blocks.length > 0 ||
    detail.functions.length > 0 ||
    detail.head.length > 0
  );
}

export function blockLabelsFor(
  inspection: SiteInspection | null,
  detail: PluginDetail,
): string[] {
  const schemas = inspection?.directiveSchemas ?? null;
  return detail.blocks.map((name) =>
    schemas !== null && Object.hasOwn(schemas, name)
      ? schemas[name].label
      : name,
  );
}

export function hasAddOnSettings(detail: PluginDetail | undefined): boolean {
  return (
    detail !== undefined &&
    detail.error === null &&
    (Object.keys(detail.settings).length > 0 || detail.functions.length > 0)
  );
}

function pluginEntryIndex(config: JsonObject, name: string): number {
  const plugins = config.plugins;
  if (!Array.isArray(plugins)) {
    return -1;
  }
  return plugins.findIndex(
    (entry) => entry === name || (isJsonObject(entry) && entry.name === name),
  );
}

export function pluginStoredSettings(
  config: JsonObject,
  name: string,
): StoredSettings {
  const plugins = Array.isArray(config.plugins) ? config.plugins : [];
  const entry = plugins[pluginEntryIndex(config, name)];
  if (!isJsonObject(entry) || entry.settings === undefined) {
    return { status: "ok", values: {} };
  }
  return isJsonObject(entry.settings)
    ? { status: "ok", values: entry.settings }
    : { status: "unreadable" };
}

function entryWithSettings(entry: JsonValue, settings: JsonObject): JsonValue {
  const base: JsonObject = isJsonObject(entry)
    ? Object.fromEntries(
        Object.entries(entry).filter(([key]) => key !== "settings"),
      )
    : { name: entry };
  if (Object.keys(settings).length > 0) {
    return { ...base, settings };
  }
  const isPlainName = Object.keys(base).every((key) => key === "name");
  return isPlainName && typeof base.name === "string" ? base.name : base;
}

export function withPluginSetting(
  config: JsonObject,
  name: string,
  setting: string,
  value: JsonValue | undefined,
): JsonObject {
  const index = pluginEntryIndex(config, name);
  const plugins = config.plugins;
  if (index === -1 || !Array.isArray(plugins)) {
    return config;
  }
  const stored = pluginStoredSettings(config, name);
  const current = stored.status === "ok" ? stored.values : {};
  const remaining = Object.fromEntries(
    Object.entries(current).filter(([key]) => key !== setting),
  );
  const next =
    value === undefined ? remaining : { ...remaining, [setting]: value };
  return {
    ...config,
    plugins: plugins.map((entry, entryIndex) =>
      entryIndex === index ? entryWithSettings(entry, next) : entry,
    ),
  };
}

export function blocksSentence(labels: string[]): string {
  return labels.length === 1
    ? `Adds a block for your pages: ${labels[0]}`
    : `Adds blocks for your pages: ${labels.join(", ")}`;
}

const settingPlaceholderPattern = /\{\{(\w+)\}\}/g;
const httpsHostPattern = /^https:\/\/([^/?#]+)/;

function hostOf(tag: PluginHeadTag): string {
  const address = tag.attributes.src ?? tag.attributes.href;
  const match =
    typeof address === "string" ? httpsHostPattern.exec(address) : null;
  return match?.[1] ?? "another website";
}

function headTagAction(tag: PluginHeadTag): string {
  const host = hostOf(tag);
  if (tag.tag === "script") {
    return `Loads a script from ${host}`;
  }
  switch (tag.attributes.rel) {
    case "stylesheet": {
      return `Loads a stylesheet from ${host}`;
    }
    case "preconnect":
    case "dns-prefetch": {
      return `Connects early to ${host}`;
    }
    default: {
      return `Preloads a file from ${host}`;
    }
  }
}

function settingsNamedBy(tag: PluginHeadTag): string[] {
  const interpolated = Object.values(tag.attributes).flatMap((value) =>
    typeof value === "string"
      ? [...value.matchAll(settingPlaceholderPattern)].map((match) => match[1])
      : [],
  );
  return [
    ...new Set([...(tag.when === null ? [] : [tag.when]), ...interpolated]),
  ];
}

function conditionFor(
  name: string,
  settings: Record<string, ThemeSettingDefinition>,
): string {
  const definition = Object.hasOwn(settings, name) ? settings[name] : null;
  const label = `“${definition?.label ?? name}”`;
  switch (definition?.type) {
    case "boolean": {
      return `${label} is on`;
    }
    case "image": {
      return `${label} has an image`;
    }
    default: {
      return `${label} is filled in`;
    }
  }
}

export function headTagSentence(
  tag: PluginHeadTag,
  settings: Record<string, ThemeSettingDefinition>,
): string {
  const conditions = settingsNamedBy(tag).map((name) =>
    conditionFor(name, settings),
  );
  const suffix =
    conditions.length === 0 ? "" : ` while ${conditions.join(" and ")}`;
  return `${headTagAction(tag)} on every page${suffix}`;
}
