import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import { runCoreCommand } from "./coreRunner.cjs";
import type {
  SiteConfig,
  SiteInspection,
  SiteNavItem,
} from "./ipcContract.cjs";

function stringArrayFrom(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
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
    plugins: "plugins" in parsed ? stringArrayFrom(parsed.plugins) : [],
  };
}

type ThemeShape = Omit<SiteInspection, "site">;

function readThemeShapeFixture(): ThemeShape {
  const fixturePath = path.join(app.getAppPath(), "fixtures", "inspect.json");
  const parsed: unknown = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error(`Unreadable inspect fixture at ${fixturePath}`);
  }
  return {
    contract:
      "contract" in parsed && typeof parsed.contract === "number"
        ? parsed.contract
        : 1,
    templates: "templates" in parsed ? stringArrayFrom(parsed.templates) : [],
    directives:
      "directives" in parsed ? stringArrayFrom(parsed.directives) : [],
    plugins: "plugins" in parsed ? stringArrayFrom(parsed.plugins) : [],
  };
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
    plugins: "plugins" in value ? stringArrayFrom(value.plugins) : [],
  };
}

function inspectionFrom(parsed: unknown): SiteInspection | null {
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
    contract: parsed.contract,
    site,
    templates: stringArrayFrom(parsed.templates),
    directives: stringArrayFrom(parsed.directives),
    plugins: "plugins" in parsed ? stringArrayFrom(parsed.plugins) : [],
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
  return inspectionFrom(parsed);
}

export async function inspectSite(sitePath: string): Promise<SiteInspection> {
  const inspected = await inspectThroughCore(sitePath);
  if (inspected !== null) {
    return inspected;
  }
  const shape = readThemeShapeFixture();
  return { ...shape, site: readSiteConfig(sitePath) };
}
