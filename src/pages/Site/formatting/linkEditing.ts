import { syntaxTree } from "@codemirror/language";
import type { EditorState, TransactionSpec } from "@codemirror/state";
import type { SyntaxNode } from "@lezer/common";
import type { ReplacedText } from "./editorEdits.ts";

type ExistingLink = {
  from: number;
  to: number;
  text: string;
  url: string;
  title: string | null;
};

export type LinkDraft = {
  text: string;
  url: string;
  range: ReplacedText;
  existing: ExistingLink | null;
};

const pastedUrlPattern = /^(?:https?:\/\/|mailto:)\S+$/i;
const resolveSides: (1 | -1)[] = [1, -1];
const bracketDepthChange: Partial<Record<string, number>> = { "[": 1, "]": -1 };

function linkFromNode(
  state: EditorState,
  node: SyntaxNode,
): ExistingLink | null {
  const marks = node.getChildren("LinkMark");
  const url = node.getChild("URL");
  const textOpen = marks[0];
  const textClose = marks[1];
  if (url === null || textOpen === undefined || textClose === undefined) {
    return null;
  }
  const title = node.getChild("LinkTitle");
  const rawUrl = state.sliceDoc(url.from, url.to);
  return {
    from: node.from,
    to: node.to,
    text: state.sliceDoc(textOpen.to, textClose.from),
    url:
      rawUrl.startsWith("<") && rawUrl.endsWith(">")
        ? rawUrl.slice(1, -1)
        : rawUrl,
    title: title === null ? null : state.sliceDoc(title.from, title.to),
  };
}

export function linkAt(
  state: EditorState,
  from: number,
  to: number,
): ExistingLink | null {
  for (const side of resolveSides) {
    for (
      let node: SyntaxNode | null = syntaxTree(state).resolveInner(
        side === 1 ? from : to,
        side,
      );
      node;
      node = node.parent
    ) {
      if (node.name === "Link" && node.from <= from && to <= node.to) {
        return linkFromNode(state, node);
      }
    }
  }
  return null;
}

export function isLinkActive(state: EditorState): boolean {
  const range = state.selection.main;
  return linkAt(state, range.from, range.to) !== null;
}

export function linkDraftFor(state: EditorState): LinkDraft {
  const range = state.selection.main;
  const existing = linkAt(state, range.from, range.to);
  if (existing !== null) {
    return {
      text: existing.text,
      url: existing.url,
      range: { from: existing.from, to: existing.to },
      existing,
    };
  }
  if (!range.empty) {
    const line = state.doc.lineAt(range.from);
    const to = Math.min(range.to, line.to);
    return {
      text: state.sliceDoc(range.from, to),
      url: "",
      range: { from: range.from, to },
      existing: null,
    };
  }
  const word = state.wordAt(range.head);
  return word === null
    ? {
        text: "",
        url: "",
        range: { from: range.head, to: range.head },
        existing: null,
      }
    : {
        text: state.sliceDoc(word.from, word.to),
        url: "",
        range: { from: word.from, to: word.to },
        existing: null,
      };
}

function hasBalancedBrackets(text: string): boolean {
  let depth = 0;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === "\\") {
      index += 1;
      continue;
    }
    depth += bracketDepthChange[char] ?? 0;
    if (depth < 0) {
      return false;
    }
  }
  return depth === 0;
}

function linkTextSource(text: string): string {
  const singleLine = text.replaceAll(/\s*[\r\n]+\s*/g, " ").trim();
  return hasBalancedBrackets(singleLine)
    ? singleLine
    : singleLine.replaceAll(/(?<!\\)([[\]])/g, String.raw`\$1`);
}

function hasBalancedParentheses(url: string): boolean {
  let depth = 0;
  for (const char of url) {
    depth += char === "(" ? 1 : char === ")" ? -1 : 0;
    if (depth < 0) {
      return false;
    }
  }
  return depth === 0;
}

function linkUrlSource(url: string): string {
  const trimmed = url.trim();
  return /[\s<>]/.test(trimmed) || !hasBalancedParentheses(trimmed)
    ? `<${trimmed.replaceAll("<", "%3C").replaceAll(">", "%3E")}>`
    : trimmed;
}

export function linkSource(
  text: string,
  url: string,
  title: string | null = null,
): string {
  const titlePart = title === null ? "" : ` ${title}`;
  return `[${linkTextSource(text)}](${linkUrlSource(url)}${titlePart})`;
}

export function applyLink(
  draft: LinkDraft,
  text: string,
  url: string,
): TransactionSpec {
  const range = draft.existing ?? draft.range;
  const source = linkSource(text, url, draft.existing?.title ?? null);
  return {
    changes: { from: range.from, to: range.to, insert: source },
    selection: { anchor: range.from + source.length },
    userEvent: "input",
    scrollIntoView: true,
  };
}

export function removeLink(
  state: EditorState,
  link: ExistingLink,
): TransactionSpec {
  const current = linkAt(state, link.from, link.to) ?? link;
  return {
    changes: { from: current.from, to: current.to, insert: current.text },
    selection: {
      anchor: current.from,
      head: current.from + current.text.length,
    },
    userEvent: "input",
  };
}

export function pastedUrl(text: string): string | null {
  const trimmed = text.trim();
  return pastedUrlPattern.test(trimmed) ? trimmed : null;
}
