import type { EditorState } from "@codemirror/state";
import type { Document } from "yaml";
import { isMap, isNode, isScalar, parseDocument } from "yaml";
import { computeFrontmatter } from "./livePreview/documentRegions.ts";

export type ContentFileKind = "page" | "post";

export type UnknownFrontmatterEntry = {
  key: string;
  value: string;
};

export type FrontmatterFields = {
  isReadable: boolean;
  title: string;
  description: string;
  slug: string;
  isDraft: boolean;
  template: string;
  date: string;
  unknownEntries: UnknownFrontmatterEntry[];
};

export type FrontmatterEdit =
  | {
      key: "title" | "description" | "slug" | "template" | "date";
      value: string;
    }
  | { key: "draft"; value: boolean };

const editableKeysByKind: Record<ContentFileKind, readonly string[]> = {
  page: ["title", "description", "slug", "draft", "template"],
  post: ["title", "description", "slug", "draft", "date"],
};

export function frontmatterYamlFromText(text: string): string | null {
  const lines = text.split(/\r\n|\n/);
  if (lines.length < 2 || lines[0] !== "---") {
    return null;
  }
  for (let index = 1; index < lines.length; index++) {
    if (lines[index] === "---") {
      return lines
        .slice(1, index)
        .map((line) => `${line}\n`)
        .join("");
    }
  }
  return null;
}

export function frontmatterYamlFromState(state: EditorState): string | null {
  const region = computeFrontmatter(state.doc);
  if (!region) {
    return null;
  }
  const openLine = state.doc.line(1);
  const closeLine = state.doc.lineAt(region.to);
  return state
    .sliceDoc(openLine.to + 1, closeLine.from)
    .replaceAll("\r\n", "\n");
}

function parseUsableDocument(yamlSource: string): Document | null {
  const document = parseDocument(yamlSource);
  if (document.errors.length > 0) {
    return null;
  }
  if (document.contents !== null && !isMap(document.contents)) {
    return null;
  }
  return document;
}

export function isFrontmatterEditable(yamlSource: string | null): boolean {
  return yamlSource === null || parseUsableDocument(yamlSource) !== null;
}

function scalarText(document: Document, key: string): string {
  const node = document.get(key, true);
  if (!isScalar(node) || node.value === null || node.value === undefined) {
    return "";
  }
  if (typeof node.value === "object") {
    return "";
  }
  return String(node.value);
}

function collectUnknownEntries(
  document: Document,
  yamlSource: string,
  kind: ContentFileKind,
): UnknownFrontmatterEntry[] {
  if (!isMap(document.contents)) {
    return [];
  }
  const editableKeys = editableKeysByKind[kind];
  return document.contents.items.flatMap((pair) => {
    if (!isScalar(pair.key) || typeof pair.key.value !== "string") {
      return [];
    }
    const key = pair.key.value;
    if (editableKeys.includes(key)) {
      return [];
    }
    const range = isNode(pair.value) ? (pair.value.range ?? null) : null;
    const value = range
      ? yamlSource.slice(range[0], range[1]).replaceAll(/\s+/g, " ").trim()
      : "";
    return [{ key, value }];
  });
}

const emptyFields: FrontmatterFields = {
  isReadable: true,
  title: "",
  description: "",
  slug: "",
  isDraft: false,
  template: "",
  date: "",
  unknownEntries: [],
};

export function deriveFrontmatterFields(
  yamlSource: string | null,
  kind: ContentFileKind,
): FrontmatterFields {
  if (yamlSource === null) {
    return emptyFields;
  }
  const document = parseUsableDocument(yamlSource);
  if (!document) {
    return { ...emptyFields, isReadable: false };
  }
  return {
    isReadable: true,
    title: scalarText(document, "title"),
    description: scalarText(document, "description"),
    slug: scalarText(document, "slug"),
    isDraft: document.get("draft") === true,
    template: scalarText(document, "template"),
    date: scalarText(document, "date"),
    unknownEntries: collectUnknownEntries(document, yamlSource, kind),
  };
}

const alwaysKeptKeys = new Set(["title", "date"]);

export function applyFrontmatterEdit(
  yamlSource: string | null,
  edit: FrontmatterEdit,
): string | null {
  const document = parseUsableDocument(yamlSource ?? "");
  if (!document) {
    return null;
  }
  if (edit.key === "draft") {
    const isDraftNow = document.get("draft") === true;
    if (edit.value === isDraftNow) {
      return null;
    }
    if (edit.value) {
      document.set("draft", true);
    } else {
      document.delete("draft");
    }
  } else {
    const keepsEmptyValue = alwaysKeptKeys.has(edit.key);
    const hasKey = document.has(edit.key);
    if (edit.value === "" && !keepsEmptyValue) {
      if (!hasKey) {
        return null;
      }
      document.delete(edit.key);
    } else {
      if (edit.value === "" && !hasKey) {
        return null;
      }
      if (hasKey && scalarText(document, edit.key) === edit.value) {
        return null;
      }
      document.set(edit.key, edit.value);
    }
  }
  if (isMap(document.contents) && document.contents.items.length === 0) {
    return "";
  }
  return document.toString({ lineWidth: 0 });
}
