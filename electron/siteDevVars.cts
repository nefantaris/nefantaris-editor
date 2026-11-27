import fs from "node:fs";
import path from "node:path";
import { gitLayer } from "./git/gitLayerInstance.cjs";
import type { DevVariable, DevVarsState } from "./ipcContract.cjs";

export const DEV_VARS_FILE = ".dev.vars";

const GITIGNORE_FILE = ".gitignore";
const variableLinePattern = /^\s*(?:export\s+)?([\w.-]+)\s*=(.*)$/;
const variableNamePattern = /^[A-Za-z_][A-Za-z0-9_]*$/;
const quoteCharacters = new Set(["'", '"', "`"]);

type ParsedLine =
  | { kind: "variable"; name: string; value: string }
  | { kind: "other"; text: string };

function readTextOrEmpty(filePath: string): string {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function unquotedValue(raw: string): string {
  const trimmed = raw.trim();
  const quote = trimmed.charAt(0);
  const closing = trimmed.lastIndexOf(quote);
  if (quoteCharacters.has(quote) && closing > 0) {
    const inner = trimmed.slice(1, closing);
    return quote === '"'
      ? inner.replaceAll(String.raw`\n`, "\n").replaceAll(String.raw`\r`, "\r")
      : inner;
  }
  const commentStart = trimmed.indexOf("#");
  return (
    commentStart === -1 ? trimmed : trimmed.slice(0, commentStart)
  ).trim();
}

function parsedLinesOf(text: string): ParsedLine[] {
  if (text === "") {
    return [];
  }
  return text
    .replace(/\r?\n$/, "")
    .split(/\r?\n/)
    .map((line): ParsedLine => {
      const match = variableLinePattern.exec(line);
      return match === null
        ? { kind: "other", text: line }
        : { kind: "variable", name: match[1], value: unquotedValue(match[2]) };
    });
}

function serializedValue(value: string): string {
  if (!/[#'"`\r\n]/.test(value) && value.trim() === value) {
    return value;
  }
  if (!/['\r\n]/.test(value)) {
    return `'${value}'`;
  }
  if (!value.includes('"')) {
    return `"${value.replaceAll("\r", String.raw`\r`).replaceAll("\n", String.raw`\n`)}"`;
  }
  return `\`${value.replaceAll(/[\r\n]/g, " ")}\``;
}

function devVarsPath(sitePath: string): string {
  return path.join(sitePath, DEV_VARS_FILE);
}

async function devVarsState(sitePath: string): Promise<DevVarsState> {
  const seen = new Set<string>();
  const variables = parsedLinesOf(
    readTextOrEmpty(devVarsPath(sitePath)),
  ).flatMap((line): DevVariable[] => {
    if (line.kind !== "variable" || seen.has(line.name)) {
      return [];
    }
    seen.add(line.name);
    return [{ name: line.name, value: line.value }];
  });
  return {
    variables,
    isIgnored: await gitLayer.isIgnored(sitePath, DEV_VARS_FILE),
  };
}

export function readDevVars(sitePath: string): Promise<DevVarsState> {
  return devVarsState(sitePath);
}

export function writeDevVars(sitePath: string, variables: DevVariable[]): void {
  const wanted = variables.filter((variable) =>
    variableNamePattern.test(variable.name),
  );
  const pending = new Map(
    wanted.map((variable) => [variable.name, variable.value]),
  );
  const kept = parsedLinesOf(readTextOrEmpty(devVarsPath(sitePath))).flatMap(
    (line): string[] => {
      if (line.kind === "other") {
        return [line.text];
      }
      const value = pending.get(line.name);
      if (value === undefined) {
        return [];
      }
      pending.delete(line.name);
      return [`${line.name}=${serializedValue(value)}`];
    },
  );
  const added = [...pending].map(
    ([name, value]) => `${name}=${serializedValue(value)}`,
  );
  const lines = [...kept, ...added];
  const hasVariables = wanted.length > 0;
  const hasOtherText = lines.some((line) => line.trim() !== "");
  if (!hasVariables && !hasOtherText) {
    fs.rmSync(devVarsPath(sitePath), { force: true });
    return;
  }
  fs.writeFileSync(devVarsPath(sitePath), `${lines.join("\n")}\n`, "utf8");
}

export async function ignoreDevVars(sitePath: string): Promise<DevVarsState> {
  const gitignorePath = path.join(sitePath, GITIGNORE_FILE);
  const existing = readTextOrEmpty(gitignorePath);
  if (!(await gitLayer.isIgnored(sitePath, DEV_VARS_FILE))) {
    const separator = existing === "" || existing.endsWith("\n") ? "" : "\n";
    fs.writeFileSync(
      gitignorePath,
      `${existing}${separator}${DEV_VARS_FILE}\n`,
      "utf8",
    );
  }
  return devVarsState(sitePath);
}
