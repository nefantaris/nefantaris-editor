import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import { runCoreCommand } from "./coreRunner.cjs";
import type {
  InspectedTheme,
  PluginDetail,
  SiteConfig,
  SiteInspection,
  SiteMode,
  SiteNavItem,
  ThemeBreakpoint,
} from "./ipcContract.cjs";
import { isJsonObject, readSiteConfigSnapshot } from "./siteConfig.cjs";
import {
  directiveSchemasFrom,
  inspectedThemeFrom,
  pluginHeadTagsFrom,
  settingDefinitionsFrom,
  settingValuesFrom,
  themePartsFrom,
} from "./themeSchemas.cjs";

const MODE_VOCABULARY: SiteMode[] = ["light", "dark"];

function stringArrayFrom(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

export function pluginNamesFrom(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item: unknown): string[] => {
    if (typeof item === "string") {
      return [item];
    }
    if (
      typeof item === "object" &&
      item !== null &&
      "name" in item &&
      typeof item.name === "string"
    ) {
      return [item.name];
    }
    return [];
  });
}

function nullableStringFrom(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function pluginDetailsFrom(value: unknown): PluginDetail[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  return value.flatMap((item: unknown): PluginDetail[] => {
    if (
      typeof item !== "object" ||
      item === null ||
      !("name" in item) ||
      typeof item.name !== "string"
    ) {
      return [];
    }
    return [
      {
        name: item.name,
        source: "source" in item ? nullableStringFrom(item.source) : null,
        version: "version" in item ? nullableStringFrom(item.version) : null,
        requiredByTheme:
          "requiredByTheme" in item && item.requiredByTheme === true,
        error: "error" in item ? nullableStringFrom(item.error) : null,
        blocks: "blocks" in item ? stringArrayFrom(item.blocks) : [],
        settings:
          ("settings" in item ? settingDefinitionsFrom(item.settings) : null) ??
          {},
        settingValues:
          "settingValues" in item ? settingValuesFrom(item.settingValues) : {},
        head: "head" in item ? pluginHeadTagsFrom(item.head) : [],
        functions: "functions" in item ? stringArrayFrom(item.functions) : [],
      },
    ];
  });
}

function breakpointsFrom(value: unknown): ThemeBreakpoint[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  return value.flatMap((item: unknown): ThemeBreakpoint[] =>
    typeof item === "object" &&
    item !== null &&
    "name" in item &&
    typeof item.name === "string" &&
    "minWidth" in item &&
    typeof item.minWidth === "number" &&
    Number.isFinite(item.minWidth) &&
    item.minWidth > 0
      ? [{ name: item.name, minWidth: item.minWidth }]
      : [],
  );
}

function navItemsFrom(value: unknown): SiteNavItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((entry: unknown): SiteNavItem[] => {
    if (
      typeof entry !== "object" ||
      entry === null ||
      !("label" in entry) ||
      typeof entry.label !== "string" ||
      !("href" in entry) ||
      typeof entry.href !== "string"
    ) {
      return [];
    }
    const children = "children" in entry ? navItemsFrom(entry.children) : [];
    if (children.length === 0) {
      return [{ label: entry.label, href: entry.href }];
    }
    return [{ label: entry.label, href: entry.href, children }];
  });
}

function readSiteConfig(sitePath: string): SiteConfig {
  const raw = fs.readFileSync(path.join(sitePath, "nefantaris.json"), "utf8");
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== "object" || parsed === null) {
    return { name: "", nav: [], plugins: [] };
  }
  return {
    name:
      "name" in parsed && typeof parsed.name === "string" ? parsed.name : "",
    nav: "nav" in parsed ? navItemsFrom(parsed.nav) : [],
    plugins: "plugins" in parsed ? pluginNamesFrom(parsed.plugins) : [],
  };
}

type ThemeShape = Omit<SiteInspection, "site" | "themeModes" | "isFallback">;

function themeShapeFrom(parsed: object): ThemeShape {
  return {
    contract:
      "contract" in parsed && typeof parsed.contract === "number"
        ? parsed.contract
        : 1,
    templates: "templates" in parsed ? stringArrayFrom(parsed.templates) : [],
    directives:
      "directives" in parsed ? stringArrayFrom(parsed.directives) : [],
    directiveSchemas:
      "directiveSchemas" in parsed
        ? directiveSchemasFrom(parsed.directiveSchemas)
        : null,
    plugins: "plugins" in parsed ? stringArrayFrom(parsed.plugins) : [],
    pluginDetails:
      "pluginDetails" in parsed
        ? pluginDetailsFrom(parsed.pluginDetails)
        : null,
    settings:
      "settings" in parsed ? settingDefinitionsFrom(parsed.settings) : null,
    settingValues:
      "settingValues" in parsed ? settingValuesFrom(parsed.settingValues) : {},
    parts: "parts" in parsed ? themePartsFrom(parsed.parts) : null,
    breakpoints:
      "breakpoints" in parsed ? breakpointsFrom(parsed.breakpoints) : null,
    theme: "theme" in parsed ? inspectedThemeFrom(parsed.theme) : null,
  };
}

function readThemeShapeFixture(): ThemeShape {
  const fixturePath = path.join(app.getAppPath(), "fixtures", "inspect.json");
  const parsed: unknown = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error(`Unreadable inspect fixture at ${fixturePath}`);
  }
  return themeShapeFrom(parsed);
}

function siteConfigFrom(value: unknown): SiteConfig | null {
  if (
    typeof value !== "object" ||
    value === null ||
    !("name" in value) ||
    typeof value.name !== "string"
  ) {
    return null;
  }
  return {
    name: value.name,
    nav: "nav" in value ? navItemsFrom(value.nav) : [],
    plugins: "plugins" in value ? pluginNamesFrom(value.plugins) : [],
  };
}

function modeListFrom(value: unknown): SiteMode[] {
  return MODE_VOCABULARY.filter(
    (mode) => Array.isArray(value) && value.includes(mode),
  );
}

function excludedModesOf(sitePath: string): SiteMode[] {
  const snapshot = readSiteConfigSnapshot(sitePath);
  if (snapshot.status !== "ok" || !isJsonObject(snapshot.config.modes)) {
    return [];
  }
  return modeListFrom(snapshot.config.modes.exclude);
}

function themeModesFrom(value: unknown, sitePath: string): SiteMode[] | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const declared = "declared" in value ? modeListFrom(value.declared) : [];
  if (declared.length > 0) {
    return declared;
  }
  if (!("available" in value)) {
    return null;
  }
  const available = modeListFrom(value.available);
  if (available.length === 0) {
    return null;
  }
  const excluded = excludedModesOf(sitePath);
  return MODE_VOCABULARY.filter(
    (mode) => available.includes(mode) || excluded.includes(mode),
  );
}

function inspectionFrom(
  parsed: unknown,
  sitePath: string,
): SiteInspection | null {
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("contract" in parsed) ||
    typeof parsed.contract !== "number" ||
    !("site" in parsed) ||
    !("templates" in parsed) ||
    !Array.isArray(parsed.templates) ||
    !("directives" in parsed) ||
    !Array.isArray(parsed.directives)
  ) {
    return null;
  }
  const site = siteConfigFrom(parsed.site);
  if (site === null) {
    return null;
  }
  return {
    ...themeShapeFrom(parsed),
    site,
    themeModes:
      "modes" in parsed ? themeModesFrom(parsed.modes, sitePath) : null,
    isFallback: false,
  };
}

async function inspectThroughCore(
  sitePath: string,
): Promise<SiteInspection | null> {
  const run = await runCoreCommand(["inspect", sitePath, "--json"]);
  if (run.status !== "ran" || run.exitCode !== 0) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(run.stdout);
  } catch {
    return null;
  }
  return inspectionFrom(parsed, sitePath);
}

export async function inspectSite(sitePath: string): Promise<SiteInspection> {
  const inspected = await inspectThroughCore(sitePath);
  if (inspected !== null) {
    return inspected;
  }
  const shape = readThemeShapeFixture();
  return {
    ...shape,
    site: readSiteConfig(sitePath),
    themeModes: null,
    isFallback: true,
  };
}

export async function resolvedThemeOf(
  sitePath: string,
): Promise<InspectedTheme | null> {
  const inspected = await inspectThroughCore(sitePath);
  return inspected?.theme ?? null;
}
