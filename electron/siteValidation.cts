import fs from "node:fs";
import path from "node:path";
import type { SiteValidationFailure } from "./ipcContract.cjs";

export type SiteValidation =
  { ok: true; siteName: string } | { ok: false; reason: SiteValidationFailure };

export function validateSiteFolder(sitePath: string): SiteValidation {
  let folderStats: fs.Stats;
  try {
    folderStats = fs.statSync(sitePath);
  } catch {
    return { ok: false, reason: "folder-missing" };
  }
  if (!folderStats.isDirectory()) {
    return { ok: false, reason: "folder-missing" };
  }

  let rawConfig: string;
  try {
    rawConfig = fs.readFileSync(path.join(sitePath, "nefantaris.json"), "utf8");
  } catch {
    return { ok: false, reason: "config-missing" };
  }

  let config: unknown;
  try {
    config = JSON.parse(rawConfig);
  } catch {
    return { ok: false, reason: "config-unparseable" };
  }

  if (
    typeof config !== "object" ||
    config === null ||
    !("name" in config) ||
    typeof config.name !== "string" ||
    config.name.trim() === ""
  ) {
    return { ok: false, reason: "name-missing" };
  }

  return { ok: true, siteName: config.name };
}
