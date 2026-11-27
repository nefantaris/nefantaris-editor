import type { Node } from "jsonc-parser";
import { findNodeAtLocation, parseTree } from "jsonc-parser";
import type {
  JsonValue,
  SiteConfigEdit,
  SiteConfigPath,
} from "./ipcContract.cjs";

type TextStyle = {
  unit: string;
  eol: string;
};

type Splice = {
  from: number;
  to: number;
  insert: string;
};

function styleOf(text: string): TextStyle {
  return {
    unit: /\n([ \t]+)\S/.exec(text)?.[1] ?? "",
    eol: text.includes("\r\n") ? "\r\n" : "\n",
  };
}

function applySplice(text: string, splice: Splice): string {
  return text.slice(0, splice.from) + splice.insert + text.slice(splice.to);
}

function endOf(node: Node): number {
  return node.offset + node.length;
}

function lineIndentAt(text: string, offset: number): string {
  const lineStart = text.lastIndexOf("\n", offset - 1) + 1;
  return /^[ \t]*/.exec(text.slice(lineStart, offset))?.[0] ?? "";
}

function isPlainObject(
  value: JsonValue,
): value is { [key: string]: JsonValue } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function inlineJson(value: JsonValue, isCompact: boolean): string {
  const separator = isCompact ? "," : ", ";
  if (Array.isArray(value)) {
    return `[${value.map((item) => inlineJson(item, isCompact)).join(separator)}]`;
  }
  if (isPlainObject(value)) {
    const entries = Object.entries(value).map(
      ([key, item]) =>
        `${JSON.stringify(key)}${isCompact ? ":" : ": "}${inlineJson(item, isCompact)}`,
    );
    if (entries.length === 0) {
      return "{}";
    }
    return isCompact
      ? `{${entries.join(separator)}}`
      : `{ ${entries.join(separator)} }`;
  }
  return JSON.stringify(value);
}

function blockJson(value: JsonValue, indent: string, style: TextStyle): string {
  if (style.unit === "") {
    return inlineJson(value, true);
  }
  return JSON.stringify(value, null, style.unit).replaceAll(
    "\n",
    style.eol + indent,
  );
}

function isContainer(node: Node): boolean {
  return node.type === "object" || node.type === "array";
}

function isSingleLine(text: string, node: Node): boolean {
  return !text.slice(node.offset, endOf(node)).includes("\n");
}

function isMultiLineContainer(text: string, container: Node): boolean {
  const [first] = container.children ?? [];
  const innerEnd = first === undefined ? endOf(container) : first.offset;
  return text.slice(container.offset, innerEnd).includes("\n");
}

function enclosingContainer(node: Node): Node | undefined {
  const parent = node.parent;
  return parent?.type === "property" ? parent.parent : parent;
}

function prefersInline(text: string, style: TextStyle, near: Node): boolean {
  if (style.unit === "") {
    return true;
  }
  if (isContainer(near) && (near.children?.length ?? 0) > 0) {
    return isSingleLine(text, near);
  }
  const enclosing = enclosingContainer(near);
  return enclosing !== undefined && isSingleLine(text, enclosing);
}

function valueText(
  text: string,
  style: TextStyle,
  value: JsonValue,
  isInline: boolean,
  indent: string,
): string {
  return isInline
    ? inlineJson(value, style.unit === "")
    : blockJson(value, indent, style);
}

function inlineSeparator(
  text: string,
  container: Node,
  style: TextStyle,
): string {
  const [first, second] = container.children ?? [];
  if (first === undefined || second === undefined) {
    return style.unit === "" ? "," : ", ";
  }
  return text.slice(endOf(first), second.offset);
}

function colonOf(text: string, objectNode: Node, style: TextStyle): string {
  const [key, value] = objectNode.children?.[0]?.children ?? [];
  if (key === undefined || value === undefined) {
    return style.unit === "" ? ":" : ": ";
  }
  return text.slice(endOf(key), value.offset);
}

function fillEmptyContainer(
  text: string,
  style: TextStyle,
  container: Node,
  entryText: (indent: string) => string,
): Splice {
  const inner = { from: container.offset + 1, to: endOf(container) - 1 };
  if (style.unit === "") {
    return { ...inner, insert: entryText("") };
  }
  const outerIndent = lineIndentAt(text, container.offset);
  const entryIndent = outerIndent + style.unit;
  return {
    ...inner,
    insert: `${style.eol}${entryIndent}${entryText(entryIndent)}${style.eol}${outerIndent}`,
  };
}

function appendEntry(
  text: string,
  style: TextStyle,
  container: Node,
  entryText: (indent: string, isInline: boolean) => string,
): Splice {
  const children = container.children ?? [];
  const last = children.at(-1);
  if (last === undefined) {
    return fillEmptyContainer(text, style, container, (indent) =>
      entryText(indent, style.unit === ""),
    );
  }
  if (isMultiLineContainer(text, container)) {
    const indent = lineIndentAt(text, children[0].offset);
    return {
      from: endOf(last),
      to: endOf(last),
      insert: `,${style.eol}${indent}${entryText(indent, false)}`,
    };
  }
  return {
    from: endOf(last),
    to: endOf(last),
    insert: `${inlineSeparator(text, container, style)}${entryText("", true)}`,
  };
}

function propertyEntry(
  text: string,
  style: TextStyle,
  objectNode: Node,
  key: string,
  value: JsonValue,
): (indent: string, isInline: boolean) => string {
  const colon = colonOf(text, objectNode, style);
  return (indent, isInline) =>
    `${JSON.stringify(key)}${colon}${valueText(text, style, value, isInline, indent)}`;
}

function wrapInPath(segments: SiteConfigPath, value: JsonValue): JsonValue {
  return segments.reduceRight<JsonValue>(
    (inner, segment) =>
      typeof segment === "number" ? [inner] : { [segment]: inner },
    value,
  );
}

function deepestExisting(
  root: Node,
  path: SiteConfigPath,
): { node: Node; depth: number } {
  for (let depth = path.length - 1; depth >= 0; depth--) {
    const node = findNodeAtLocation(root, path.slice(0, depth));
    if (node !== undefined) {
      return { node, depth };
    }
  }
  return { node: root, depth: 0 };
}

function setSplice(
  text: string,
  style: TextStyle,
  root: Node,
  path: SiteConfigPath,
  value: JsonValue,
): Splice {
  const existing = findNodeAtLocation(root, path);
  if (existing !== undefined) {
    const isScalar = typeof value !== "object" || value === null;
    return {
      from: existing.offset,
      to: endOf(existing),
      insert: isScalar
        ? JSON.stringify(value)
        : valueText(
            text,
            style,
            value,
            prefersInline(text, style, existing),
            lineIndentAt(text, existing.offset),
          ),
    };
  }
  const { node: parent, depth } = deepestExisting(root, path);
  const segment = path[depth];
  const remainder = wrapInPath(path.slice(depth + 1), value);
  if (parent.type === "object" && typeof segment === "string") {
    return appendEntry(
      text,
      style,
      parent,
      propertyEntry(text, style, parent, segment, remainder),
    );
  }
  if (parent.type === "array" && segment === (parent.children ?? []).length) {
    return insertSplice(text, style, parent, segment, remainder);
  }
  throw new Error(`Cannot set ${JSON.stringify(path)} in nefantaris.json`);
}

function insertSplice(
  text: string,
  style: TextStyle,
  array: Node,
  index: number,
  value: JsonValue,
): Splice {
  const children = array.children ?? [];
  if (!Number.isInteger(index) || index < 0 || index > children.length) {
    throw new RangeError(`Cannot insert at ${index} in an array`);
  }
  const neighbour = children[index - 1] ?? children[index];
  const entryText = (indent: string, isInline: boolean) =>
    valueText(
      text,
      style,
      value,
      isInline ||
        (neighbour !== undefined && prefersInline(text, style, neighbour)),
      indent,
    );
  const before = children[index];
  if (before === undefined) {
    return appendEntry(text, style, array, entryText);
  }
  if (isMultiLineContainer(text, array)) {
    const indent = lineIndentAt(text, children[0].offset);
    return {
      from: before.offset,
      to: before.offset,
      insert: `${entryText(indent, false)},${style.eol}${indent}`,
    };
  }
  return {
    from: before.offset,
    to: before.offset,
    insert: `${entryText("", true)}${inlineSeparator(text, array, style)}`,
  };
}

function removeSplice(text: string, root: Node, path: SiteConfigPath): Splice {
  const target = findNodeAtLocation(root, path);
  const unit = target?.parent?.type === "property" ? target.parent : target;
  const container = unit?.parent;
  if (unit === undefined || container === undefined) {
    return { from: 0, to: 0, insert: "" };
  }
  const siblings = container.children ?? [];
  const index = siblings.indexOf(unit);
  const next = siblings[index + 1];
  if (next !== undefined) {
    return { from: unit.offset, to: next.offset, insert: "" };
  }
  const previous = siblings[index - 1];
  if (previous !== undefined) {
    return { from: endOf(previous), to: endOf(unit), insert: "" };
  }
  return { from: container.offset + 1, to: endOf(container) - 1, insert: "" };
}

function moveSplices(
  text: string,
  root: Node,
  path: SiteConfigPath,
  from: number,
  to: number,
): Splice[] {
  const array = findNodeAtLocation(root, path);
  const slots = array?.type === "array" ? (array.children ?? []) : [];
  const isInRange = (index: number) =>
    Number.isInteger(index) && index >= 0 && index < slots.length;
  if (!isInRange(from) || !isInRange(to)) {
    throw new RangeError(`Cannot move ${from} to ${to} in an array`);
  }
  const slotTexts = slots.map((slot) => text.slice(slot.offset, endOf(slot)));
  const reordered = slotTexts
    .toSpliced(from, 1)
    .toSpliced(to, 0, slotTexts[from]);
  return slots
    .map((slot, index) => ({
      from: slot.offset,
      to: endOf(slot),
      insert: reordered[index],
    }))
    .toReversed();
}

export function applyJsonEdit(text: string, edit: SiteConfigEdit): string {
  const root = parseTree(text);
  if (root === undefined) {
    throw new Error("nefantaris.json could not be parsed");
  }
  const style = styleOf(text);
  switch (edit.kind) {
    case "set": {
      return applySplice(
        text,
        setSplice(text, style, root, edit.path, edit.value),
      );
    }
    case "insert": {
      const index = edit.path.at(-1);
      const array = findNodeAtLocation(root, edit.path.slice(0, -1));
      if (typeof index !== "number" || array?.type !== "array") {
        return applySplice(
          text,
          setSplice(text, style, root, edit.path, edit.value),
        );
      }
      return applySplice(
        text,
        insertSplice(text, style, array, index, edit.value),
      );
    }
    case "remove": {
      return applySplice(text, removeSplice(text, root, edit.path));
    }
    case "move": {
      return moveSplices(text, root, edit.path, edit.from, edit.to).reduce(
        applySplice,
        text,
      );
    }
  }
}
