import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import type { RecentSite } from "./ipcContract.cjs";

const RECENT_SITES_LIMIT = 10;

function recentSitesFile(): string {
  return path.join(app.getPath("userData"), "recent-sites.json");
}

function isRecentSite(value: unknown): value is RecentSite {
  return (
    typeof value === "object" &&
    value !== null &&
    "path" in value &&
    typeof value.path === "string" &&
    "name" in value &&
    typeof value.name === "string" &&
    "lastOpenedAt" in value &&
    typeof value.lastOpenedAt === "number"
  );
}

export function loadRecentSites(): RecentSite[] {
  let raw: string;
  try {
    raw = fs.readFileSync(recentSitesFile(), "utf8");
  } catch {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed.filter(isRecentSite);
}

function saveRecentSites(sites: RecentSite[]): void {
  fs.mkdirSync(app.getPath("userData"), { recursive: true });
  fs.writeFileSync(recentSitesFile(), JSON.stringify(sites, null, 2));
}

export function recordRecentSite(site: RecentSite): RecentSite[] {
  const others = loadRecentSites().filter((known) => known.path !== site.path);
  const sites = [site, ...others].slice(0, RECENT_SITES_LIMIT);
  saveRecentSites(sites);
  return sites;
}

export function removeRecentSite(sitePath: string): RecentSite[] {
  const sites = loadRecentSites().filter((known) => known.path !== sitePath);
  saveRecentSites(sites);
  return sites;
}
