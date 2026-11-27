import { parseEntities } from "parse-entities";
import type { BlockBody } from "../../../electron/ipcContract.cts";

export type AttributeToken = {
  key: string;
  value: string;
  from: number;
  to: number;
};

export type DirectiveAttributesSpan = {
  from: number;
  to: number;
  tokens: AttributeToken[];
};

export type DirectiveLabelSpan = {
  from: number;
  to: number;
};

export type DirectiveLine = {
  kind: "leaf" | "container";
  fenceFrom: number;
  fenceLength: number;
  name: string;
  headTo: number;
  label: DirectiveLabelSpan | null;
  attributes: DirectiveAttributesSpan | null;
};

export type DirectiveLineEdit = {
  attributes: Map<string, string | null>;
  label?: string | null;
};

export type BlockSourceLines = {
  lines: string[];
  cursorLine: number;
  isCursorAtLineEnd: boolean;
};

const MAX_INDENT = 3;
const LEAF_FENCE_LENGTH = 2;
const SHORTEST_CONTAINER_FENCE_LENGTH = 3;

const whitespacePattern = /\s/u;
const punctuationPattern = /[\p{P}\p{S}]/u;
const closingFencePattern = /^ {0,3}(:{3,})[ \t]*$/;
const containerFencePattern = /^[ \t]*(:{3,})/gm;
const referenceStartPattern = /&(?=[#A-Za-z0-9])/g;
const valueBreakers = new Set(['"', "'", "<", "=", ">", "`"]);
const shortcutEnders = new Set(["#", ".", "}"]);

function isLineSpace(char: string | undefined): boolean {
  return char === " " || char === "\t";
}

function isPunctuation(char: string): boolean {
  return punctuationPattern.test(char);
}

function isWhitespace(char: string): boolean {
  return whitespacePattern.test(char);
}

function decodeAttributeValue(raw: string): string {
  return parseEntities(raw, { attribute: true });
}

function skipLineSpaces(text: string, from: number): number {
  let index = from;
  while (isLineSpace(text[index])) {
    index += 1;
  }
  return index;
}

function runLength(text: string, from: number, char: string): number {
  let index = from;
  while (text[index] === char) {
    index += 1;
  }
  return index - from;
}

function isNameCharacter(char: string): boolean {
  return (
    char === "-" ||
    char === "_" ||
    (!isWhitespace(char) && !isPunctuation(char))
  );
}

function nameEnd(text: string, from: number): number | null {
  const first = text[from];
  if (first === undefined || isWhitespace(first) || isPunctuation(first)) {
    return null;
  }
  let index = from + 1;
  while (index < text.length && isNameCharacter(text[index])) {
    index += 1;
  }
  const last = text[index - 1];
  return last === "-" || last === "_" ? null : index;
}

function labelEnd(text: string, from: number): number | null {
  let balance = 0;
  for (let index = from + 1; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === "\\" && (next === "[" || next === "]" || next === "\\")) {
      index += 1;
    } else if (char === "[") {
      balance += 1;
    } else if (char === "]") {
      if (balance === 0) {
        return index + 1;
      }
      balance -= 1;
    }
  }
  return null;
}

function isAttributeNameCharacter(char: string): boolean {
  return (
    !isWhitespace(char) &&
    (!isPunctuation(char) ||
      char === "-" ||
      char === "." ||
      char === ":" ||
      char === "_")
  );
}

type TokenRead = { token: AttributeToken; next: number } | null;

function readShortcut(text: string, from: number): TokenRead {
  const valueFrom = from + 1;
  let index = valueFrom;
  for (;;) {
    const char = text[index];
    if (char === undefined || valueBreakers.has(char)) {
      return null;
    }
    if (shortcutEnders.has(char) || isLineSpace(char)) {
      break;
    }
    index += 1;
  }
  if (index === valueFrom) {
    return null;
  }
  return {
    token: {
      key: text[from] === "#" ? "id" : "class",
      value: decodeAttributeValue(text.slice(valueFrom, index)),
      from,
      to: index,
    },
    next: index,
  };
}

function readQuotedValue(
  text: string,
  quoteAt: number,
): { raw: string; to: number } | null {
  const close = text.indexOf(text[quoteAt], quoteAt + 1);
  if (close === -1) {
    return null;
  }
  const after = text[close + 1];
  if (after !== "}" && !isLineSpace(after)) {
    return null;
  }
  return { raw: text.slice(quoteAt + 1, close), to: close + 1 };
}

function readUnquotedValue(
  text: string,
  from: number,
): { raw: string; to: number } | null {
  let index = from;
  for (;;) {
    const char = text[index];
    if (char === undefined || valueBreakers.has(char)) {
      return null;
    }
    if (char === "}" || isLineSpace(char)) {
      return { raw: text.slice(from, index), to: index };
    }
    index += 1;
  }
}

function readNamedAttribute(text: string, from: number): TokenRead {
  let nameTo = from + 1;
  while (nameTo < text.length && isAttributeNameCharacter(text[nameTo])) {
    nameTo += 1;
  }
  const key = text.slice(from, nameTo);
  const afterName = skipLineSpaces(text, nameTo);
  if (text[afterName] !== "=") {
    return { token: { key, value: "", from, to: nameTo }, next: afterName };
  }
  const valueFrom = skipLineSpaces(text, afterName + 1);
  const first = text[valueFrom];
  const isQuoted = first === '"' || first === "'";
  if (
    !isQuoted &&
    (first === undefined || first === "}" || valueBreakers.has(first))
  ) {
    return null;
  }
  const value = isQuoted
    ? readQuotedValue(text, valueFrom)
    : readUnquotedValue(text, valueFrom);
  if (value === null) {
    return null;
  }
  return {
    token: { key, value: decodeAttributeValue(value.raw), from, to: value.to },
    next: value.to,
  };
}

function readAttribute(text: string, from: number): TokenRead {
  const char = text[from];
  if (char === "#" || char === ".") {
    return readShortcut(text, from);
  }
  if (
    isWhitespace(char) ||
    (isPunctuation(char) && char !== "-" && char !== "_")
  ) {
    return null;
  }
  return readNamedAttribute(text, from);
}

function parseAttributes(
  text: string,
  from: number,
): DirectiveAttributesSpan | null {
  const tokens: AttributeToken[] = [];
  let index = from + 1;
  for (;;) {
    index = skipLineSpaces(text, index);
    if (index >= text.length) {
      return null;
    }
    if (text[index] === "}") {
      return { from, to: index + 1, tokens };
    }
    const read = readAttribute(text, index);
    if (read === null) {
      return null;
    }
    tokens.push(read.token);
    index = read.next;
  }
}

export function parseDirectiveLine(text: string): DirectiveLine | null {
  const fenceFrom = runLength(text, 0, " ");
  if (fenceFrom > MAX_INDENT) {
    return null;
  }
  const fenceLength = runLength(text, fenceFrom, ":");
  if (fenceLength < LEAF_FENCE_LENGTH) {
    return null;
  }
  const nameFrom = fenceFrom + fenceLength;
  const nameTo = nameEnd(text, nameFrom);
  if (nameTo === null) {
    return null;
  }
  const headTo = text[nameTo] === "[" ? labelEnd(text, nameTo) : nameTo;
  if (headTo === null) {
    return null;
  }
  const attributes =
    text[headTo] === "{" ? parseAttributes(text, headTo) : null;
  if (text[headTo] === "{" && attributes === null) {
    return null;
  }
  if (skipLineSpaces(text, attributes?.to ?? headTo) !== text.length) {
    return null;
  }
  return {
    kind: fenceLength === LEAF_FENCE_LENGTH ? "leaf" : "container",
    fenceFrom,
    fenceLength,
    name: text.slice(nameFrom, nameTo),
    headTo,
    label: headTo === nameTo ? null : { from: nameTo, to: headTo },
    attributes,
  };
}

export function closingFenceOf(
  text: string,
): { from: number; length: number } | null {
  const match = closingFencePattern.exec(text);
  if (match === null) {
    return null;
  }
  return { from: match[0].indexOf(":"), length: match[1].length };
}

export function attributeValuesFrom(
  tokens: AttributeToken[],
): Record<string, string> {
  const values = new Map<string, string>();
  for (const token of tokens) {
    const earlierClass =
      token.key === "class" ? values.get("class") : undefined;
    values.set(
      token.key,
      earlierClass === undefined
        ? token.value
        : `${earlierClass} ${token.value}`,
    );
  }
  return Object.fromEntries(values);
}

export function quoteAttributeValue(value: string): string {
  const escaped = value
    .replaceAll(referenceStartPattern, "&amp;")
    .replaceAll("\r", "&#13;")
    .replaceAll("\n", "&#10;");
  if (!escaped.includes('"')) {
    return `"${escaped}"`;
  }
  if (!escaped.includes("'")) {
    return `'${escaped}'`;
  }
  return `"${escaped.replaceAll('"', "&quot;")}"`;
}

export function attributeSource(name: string, value: string | true): string {
  return value === true ? name : `${name}=${quoteAttributeValue(value)}`;
}

export function attributeBlock(entries: string[]): string {
  return entries.length === 0 ? "" : `{${entries.join(" ")}}`;
}

export function longestContainerFence(body: string): number {
  return Math.max(
    0,
    ...[...body.matchAll(containerFencePattern)].map(
      (match) => match[1].length,
    ),
  );
}

export function containerFenceLength(body: string): number {
  return Math.max(
    SHORTEST_CONTAINER_FENCE_LENGTH,
    longestContainerFence(body) + 1,
  );
}

function unbalancedBracketPositions(text: string): Set<number> {
  const marked = new Set<number>();
  const open: number[] = [];
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "\\") {
      if (index === text.length - 1) {
        marked.add(index);
      }
      index += 1;
    } else if (char === "[") {
      open.push(index);
    } else if (char === "]" && open.pop() === undefined) {
      marked.add(index);
    }
  }
  for (const index of open) {
    marked.add(index);
  }
  return marked;
}

export function labelSource(text: string): string {
  const flat = text.replaceAll(/\r?\n/g, " ");
  const marked = unbalancedBracketPositions(flat);
  return [...flat]
    .map((char, index) => (marked.has(index) ? `\\${char}` : char))
    .join("");
}

export function labelTextOf(text: string, line: DirectiveLine): string | null {
  return line.label === null
    ? null
    : text.slice(line.label.from + 1, line.label.to - 1);
}

export function blockSourceLines(
  name: string,
  body: BlockBody,
  attributes: string,
  content: string | null,
  label: string | null = null,
): BlockSourceLines {
  if (body === "none") {
    return {
      lines: [`::${name}${label === null ? "" : `[${label}]`}${attributes}`],
      cursorLine: 0,
      isCursorAtLineEnd: true,
    };
  }
  const inner = content?.trimEnd() ?? "";
  const fence = ":".repeat(containerFenceLength(inner));
  const lines = [
    `${fence}${name}${attributes}`,
    ...inner.split(/\r?\n/),
    fence,
  ];
  return body === "images"
    ? { lines, cursorLine: lines.length - 1, isCursorAtLineEnd: true }
    : { lines, cursorLine: 1, isCursorAtLineEnd: false };
}

function rewrittenAttributes(
  text: string,
  line: DirectiveLine,
  replacements: Map<string, string | null>,
): string {
  const from = line.attributes?.from ?? line.headTo;
  const to = line.attributes?.to ?? line.headTo;
  if (replacements.size === 0) {
    return text.slice(from, to);
  }
  const emitted = new Set<string>();
  const kept = (line.attributes?.tokens ?? []).flatMap((token): string[] => {
    if (!replacements.has(token.key)) {
      return [text.slice(token.from, token.to)];
    }
    if (emitted.has(token.key)) {
      return [];
    }
    emitted.add(token.key);
    const replacement = replacements.get(token.key);
    return replacement === null || replacement === undefined
      ? []
      : [replacement];
  });
  const added = [...replacements].flatMap(([key, replacement]): string[] =>
    emitted.has(key) || replacement === null ? [] : [replacement],
  );
  return attributeBlock([...kept, ...added]);
}

export function directiveHeadSpan(line: DirectiveLine): {
  from: number;
  to: number;
} {
  return {
    from: line.label?.from ?? line.headTo,
    to: line.attributes?.to ?? line.headTo,
  };
}

export function rewriteDirectiveLine(
  text: string,
  line: DirectiveLine,
  edit: DirectiveLineEdit,
): string {
  const span = directiveHeadSpan(line);
  const label =
    edit.label === undefined
      ? line.label === null
        ? ""
        : text.slice(line.label.from, line.label.to)
      : edit.label === null
        ? ""
        : `[${edit.label}]`;
  const attributes = rewrittenAttributes(text, line, edit.attributes);
  return `${text.slice(0, span.from)}${label}${attributes}${text.slice(span.to)}`;
}
