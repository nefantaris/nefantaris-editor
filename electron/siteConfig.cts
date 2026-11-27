import fs from "node:fs";
import path from "node:path";
import type {
  JsonObject,
  JsonValue,
  SiteConfigEdit,
  SiteConfigSnapshot,
} from "./ipcContract.cjs";
import { applyJsonEdit } from "./jsonSurgery.cjs";

const CONFIG_FILE_NAME = "nefantaris.json";

export function siteConfigFilePath(sitePath: string): string {
  return path.join(sitePath, CONFIG_FILE_NAME);
}

function jsonValueFrom(value: unknown): JsonValue {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item: unknown) => jsonValueFrom(item));
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, jsonValueFrom(item)]),
    );
  }
  throw new TypeError(`Not a JSON value: ${String(value)}`);
}

export function isJsonObject(
  value: JsonValue | undefined,
): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseSiteConfigText(text: string): JsonObject | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  const value = jsonValueFrom(parsed);
  return isJsonObject(value) ? value : null;
}

function readConfigText(sitePath: string): string | null {
  try {
    return fs.readFileSync(siteConfigFilePath(sitePath), "utf8");
  } catch {
    return null;
  }
}

function snapshotFromText(text: string | null): SiteConfigSnapshot {
  if (text === null) {
    return { status: "missing" };
  }
  const config = parseSiteConfigText(text);
  return config === null ? { status: "unreadable" } : { status: "ok", config };
}

export function readSiteConfigSnapshot(sitePath: string): SiteConfigSnapshot {
  return snapshotFromText(readConfigText(sitePath));
}

export function applySiteConfigEdits(
  text: string,
  edits: SiteConfigEdit[],
): string {
  const result = edits.reduce(applyJsonEdit, text);
  if (parseSiteConfigText(result) === null) {
    throw new Error("Editing nefantaris.json produced an unreadable file");
  }
  return result;
}

export function editSiteConfig(
  sitePath: string,
  edits: SiteConfigEdit[],
): SiteConfigSnapshot {
  const text = readConfigText(sitePath);
  const before = snapshotFromText(text);
  if (text === null || before.status !== "ok") {
    return before;
  }
  const updated = applySiteConfigEdits(text, edits);
  if (updated === text) {
    return before;
  }
  fs.writeFileSync(siteConfigFilePath(sitePath), updated, "utf8");
  return snapshotFromText(updated);
}
