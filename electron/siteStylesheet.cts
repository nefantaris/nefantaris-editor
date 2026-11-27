import fs from "node:fs";
import path from "node:path";
import { runCoreCommand } from "./coreRunner.cjs";
import type { StyleFinding, ThemeStyleToken } from "./ipcContract.cjs";
import { resolveInside } from "./pathConfinement.cjs";
import { resolvedThemeOf } from "./siteInspect.cjs";

export const SITE_STYLESHEET_FILE = "custom.css";

const THEME_STYLESHEET_FILE = "theme.css";
const CHILD_THEME_DIR = "child-theme";
const UNKNOWN_PART_RULE = "styles/unknown-part";
const TOKEN_VALUE_LIMIT = 60;

const commentPattern = /\/\*[\s\S]*?\*\//g;
const customPropertyPattern = /(--[A-Za-z0-9_-]+)\s*:\s*([^;{}]*)/g;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stylesheetPath(sitePath: string): string {
  return path.join(sitePath, SITE_STYLESHEET_FILE);
}

function readTextOrNull(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

export function readSiteStylesheet(sitePath: string): string {
  return readTextOrNull(stylesheetPath(sitePath)) ?? "";
}

export function writeSiteStylesheet(sitePath: string, text: string): void {
  if (text.trim() === "") {
    fs.rmSync(stylesheetPath(sitePath), { force: true });
    return;
  }
  fs.writeFileSync(stylesheetPath(sitePath), text, "utf8");
}

function styleFindingFrom(value: unknown): StyleFinding[] {
  if (
    !isRecord(value) ||
    value.file !== SITE_STYLESHEET_FILE ||
    value.rule !== UNKNOWN_PART_RULE ||
    typeof value.message !== "string"
  ) {
    return [];
  }
  const line =
    typeof value.line === "number" && Number.isInteger(value.line)
      ? value.line
      : null;
  return [{ rule: value.rule, message: value.message, line }];
}

export async function siteStylesheetFindings(
  sitePath: string,
): Promise<StyleFinding[]> {
  const run = await runCoreCommand(["doctor", sitePath, "--json"]);
  if (run.status !== "ran") {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(run.stdout);
  } catch {
    return [];
  }
  if (!isRecord(parsed) || !Array.isArray(parsed.findings)) {
    return [];
  }
  return parsed.findings.flatMap(styleFindingFrom);
}

function collapsedValue(value: string): string {
  return value.replaceAll(/\s+/g, " ").trim();
}

function compactValue(value: string): string {
  const compact = collapsedValue(value);
  return compact.length > TOKEN_VALUE_LIMIT
    ? `${compact.slice(0, TOKEN_VALUE_LIMIT - 1)}…`
    : compact;
}

export function customPropertiesIn(
  css: string,
  shownValue: (value: string) => string = compactValue,
): ThemeStyleToken[] {
  const tokens = new Map<string, string>();
  for (const match of css
    .replaceAll(commentPattern, "")
    .matchAll(customPropertyPattern)) {
    if (!tokens.has(match[1])) {
      tokens.set(match[1], shownValue(match[2]));
    }
  }
  return [...tokens].map(([name, value]) => ({ name, value }));
}

async function resolvedThemeStylesheet(
  sitePath: string,
): Promise<string | null> {
  const shadowed = readTextOrNull(
    path.join(sitePath, CHILD_THEME_DIR, THEME_STYLESHEET_FILE),
  );
  if (shadowed !== null) {
    return shadowed;
  }
  const theme = await resolvedThemeOf(sitePath);
  return theme === null
    ? null
    : readTextOrNull(resolveInside(theme.dir, THEME_STYLESHEET_FILE, "."));
}

export async function themeStyleTokens(
  sitePath: string,
): Promise<ThemeStyleToken[]> {
  const css = await resolvedThemeStylesheet(sitePath);
  return css === null ? [] : customPropertiesIn(css);
}

export async function themeTokenValues(
  sitePath: string,
): Promise<ThemeStyleToken[]> {
  const css = await resolvedThemeStylesheet(sitePath);
  return css === null ? [] : customPropertiesIn(css, collapsedValue);
}
